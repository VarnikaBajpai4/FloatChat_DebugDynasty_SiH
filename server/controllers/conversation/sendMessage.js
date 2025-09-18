//this will be the main point of this system. expect a very large file here
const Conversation = require("../../models/Conversation");
const ChatMessage = require("../../models/ChatMessage");
const User = require("../../models/User");
const axios = require("axios");
const sendMessageStream = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { message } = req.body;

    if (!message || !conversationId) {
      return res.status(400).json({
        success: false,
        message: "Message and conversationId are required",
      });
    }

    const user = await User.findById(userId);
    const conversation = await Conversation.findById(conversationId);

    if (!user || !conversation) {
      return res
        .status(404)
        .json({ success: false, message: "User or conversation not found" });
    }

    if (conversation.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const userMessage = await ChatMessage.create({
      conversationId,
      userId,
      role: "user",
      content: message,
      metadata: {},
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    res.write(`event: ack\n`);
    res.write(`data: ${JSON.stringify({ status: "processing" })}\n\n`);

    // Build context for core query
    const historyDocs = await ChatMessage.find({ conversationId })
      .sort({ timestamp: 1 }) // Sort by timestamp in ascending order
      .select("content role");

    const messages = historyDocs.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const coreBase = process.env.CORE_BASE_URL || "http://localhost:7500";

    let summary = "";
    let visualization_url = null;
    let qc = null;

    // Helper to close polygon loop in message without altering stored user content
    const closePolygonLoopIfPresent = (msg) => {
      try {
        const lines = String(msg || "").split(/\r?\n/);
        const idx = lines.findIndex((l) => /Polygon\s*\(lat,\s*lon\)/i.test(l));
        if (idx === -1) return msg;

        const line = lines[idx];
        const before = line.split(":")[0] || line;
        const coordsStr = line.includes(":") ? line.split(":").slice(1).join(":") : "";

        const items = coordsStr.split("|").map((s) => s.trim()).filter(Boolean);
        const coords = [];
        for (const it of items) {
          const m = it.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
          if (m) {
            const lat = parseFloat(m[1]);
            const lng = parseFloat(m[2]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) coords.push([lat, lng]);
          }
        }

        if (coords.length < 3) return msg; // not a polygon
        const [fLat, fLng] = coords[0];
        const [lLat, lLng] = coords[coords.length - 1];
        const isClosed = Math.abs(fLat - lLat) < 1e-9 && Math.abs(fLng - lLng) < 1e-9;
        if (!isClosed) coords.push([fLat, fLng]);

        const rebuilt = coords
          .map(([lat, lng]) => `${lat.toFixed(4)},${lng.toFixed(4)}`)
          .join(" | ");
        lines[idx] = `${before}: ${rebuilt}`;
        return lines.join("\n");
      } catch {
        return msg;
      }
    };

    const messageForCore = closePolygonLoopIfPresent(message);

    // Directly call core /query via axios (no AbortController, no fallback)
    try {
      const response = await axios.post(
        `${coreBase}/query`,
        {
          message: messageForCore,
          role: conversation.role, // 'Default' | 'Student' | 'Researcher' | 'Policy-Maker'
          history: messages,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: Number(process.env.CORE_QUERY_TIMEOUT_MS || 180000),
        }
      );
      console.log(response.data)
      summary = response.data.text;
      visualization_url = response.data.links || null;
      qc =
        typeof response.data.qc === "number"
          ? response.data.qc
          : typeof response.data.QC === "number"
          ? response.data.QC
          : null;
    } catch (e) {
      throw e;
    }

    // Stream tokens word-by-word to client (preserve current SSE behavior)
    const tokens = summary.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      res.write(`event: token\n`);
      res.write(`data: ${JSON.stringify({ content: token })}\n\n`);
      await new Promise((r) => setTimeout(r, 100)); // simulate delay
    }

    // Save assistant response with metadata from core (if any)
    const finalLink = Array.isArray(visualization_url) ? visualization_url[0] : visualization_url;
    const aiMessage = await ChatMessage.create({
      conversationId,
      userId,
      role: "assistant",
      content: summary,
      metadata: {
        visualization_url,
        link: finalLink || null,
        qc,
      },
    });

    conversation.updatedAt = new Date();
    await conversation.save();

    // Send final event (forward visualization link and qc as requested)
    res.write(`event: done\n`);
    res.write(
      `data: ${JSON.stringify({
        messageId: aiMessage._id,
        visualization_url: finalLink || null,
        link: finalLink || null,
        qc,
      })}\n\n`
    );
    res.end();
  } catch (err) {
    console.error(err);
    res.end(
      `event: error\ndata: ${JSON.stringify({
        error: "Internal Server Error",
      })}\n\n`
    );
  }
};
module.exports = sendMessageStream;
