const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Load .env from default location (process.cwd())
try {
  require('dotenv').config();
} catch {}

const ALLOWED_VARIABLES = new Set(['temperature', 'salinity', 'pressure']);

function pickPythonBin(rootDir) {
  const envBin = (process.env.PYTHON_BIN || '').trim();
  if (envBin) return envBin;

  // Prefer project venv if present
  try {
    const winVenv = path.resolve(rootDir, 'core/.venv/Scripts/python.exe');
    const nixVenv = path.resolve(rootDir, 'core/.venv/bin/python');
    if (process.platform === 'win32') {
      fs.accessSync(winVenv, fs.constants.X_OK);
      return winVenv;
    } else {
      fs.accessSync(nixVenv, fs.constants.X_OK);
      return nixVenv;
    }
  } catch {}

  // Fallbacks
  if (process.platform === 'win32') return 'py';
  return 'python3';
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Spawns the Python predictor and returns its stdout as text.
 * @param {string[]} args
 * @param {{cwd: string, timeoutMs: number}} options
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
function runPython(pythonBin, args, { cwd, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(pythonBin, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {}
    }, Math.max(5000, Number(timeoutMs) || 60000));

    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

/**
 * POST /api/predictions
 * Body: {
 *   variable: "temperature" | "salinity" | "pressure", (required)
 *   horizon: "5 days" | "2 weeks" | "3 months" | "1 year",            (required)
 *   sinceDays?: number (default 1095),
 *   returnHistory?: boolean (default true),
 *   historyDays?: number (default 30)
 * }
 */
module.exports = async function runPrediction(req, res) {
  try {
    const {
      variable,
      horizon,
      sinceDays = 1095,
      returnHistory = true,
      historyDays = 30,
    } = req.body || {};

    const v = String(variable || '').trim().toLowerCase();
    if (!v || !ALLOWED_VARIABLES.has(v)) {
      return res.status(400).json({
        success: false,
        error: "Invalid 'variable'. Use one of: temperature, salinity, pressure",
      });
    }

    const h = String(horizon || '').trim();
    if (!h) {
      return res.status(400).json({
        success: false,
        error: "Missing 'horizon'. Examples: '5 days', '2 weeks', '3 months', '1 year'",
      });
    }

    const since = Number.isFinite(Number(sinceDays)) ? Number(sinceDays) : 1095;
    const histDays = Number.isFinite(Number(historyDays)) ? Number(historyDays) : 30;
    const retHist = Boolean(returnHistory);

    const ROOT = path.resolve(__dirname, '../../../');
    const CORE_DIR = path.resolve(ROOT, 'core');
    const scriptPath = 'predictions/prediction.py';

    const args = [
      scriptPath,
      '--variable', v,
      '--horizon', h,
      '--since-days', String(since),
      '--return-history', String(retHist),
      '--history-days', String(histDays),
      '--json',
    ];

    const timeoutMs = Number(process.env.PREDICT_TIMEOUT_MS || 60000);
    const pythonBin = pickPythonBin(ROOT);
    const { code, stdout, stderr } = await runPython(pythonBin, args, { cwd: CORE_DIR, timeoutMs });

    // If Python errored hard and printed nothing useful
    if (code !== 0 && !stdout) {
      console.error('[predictions] Python process failed', { code, stderr: (stderr || '').slice(0, 2000) });
      return res.status(500).json({
        success: false,
        error: 'Prediction process failed',
        details: (stderr || 'No error output').slice(0, 4000),
      });
    }

    const parsed = safeJsonParse(stdout?.trim() || '');
    if (!parsed) {
      console.error('[predictions] Failed to parse JSON from predictor', {
        stdout: (stdout || '').slice(0, 500),
        stderr: (stderr || '').slice(0, 2000),
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to parse predictor output as JSON',
        details: (stdout || '').slice(0, 2000),
      });
    }

    if (parsed.success === false) {
      // Python returned a structured error
      console.error('[predictions] Predictor returned error', parsed);
      return res.status(400).json(parsed);
    }

    // Enforce response contract and attach minimal meta
    const response = {
      success: true,
      input: parsed.input,
      unit: parsed.unit,
      predictions: Array.isArray(parsed.predictions) ? parsed.predictions : [],
      history: parsed.input?.returnHistory ? (parsed.history || []) : undefined,
      model: parsed.model || 'LinearRegression',
      meta: {
        ...(parsed.meta || {}),
        processExitCode: code,
        stderr: stderr ? stderr.slice(0, 2000) : undefined,
      },
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error('[predictions] Unhandled server error while running prediction', err);
    return res.status(500).json({
      success: false,
      error: 'Unhandled server error while running prediction',
      details: err?.message || String(err),
    });
  }
};