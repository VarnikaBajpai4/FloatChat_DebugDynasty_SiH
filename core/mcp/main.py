import os
import uuid

from fastapi import FastAPI
from fastmcp import FastMCP
from tools.sql_query import sql_query, SqlQueryInput
from db.postgres import postgres_db
from dotenv import load_dotenv

load_dotenv()


app = FastAPI()

mcp = FastMCP.from_fastapi(app=app, name="FloatChat MCP")

@mcp.tool()
async def sql_query_tool(query: str):
    if not postgres_db.pool:
        await postgres_db.connect()
    params = SqlQueryInput(query=query)
    result = await sql_query(params)
    return result

@mcp.resource("data://knowledge_base/sql_schema_json")
def get_sql_schema_json() -> dict:
    """Provides the SQL schema for the FloatChat database in structured JSON."""
    return {
        "extensions": ["postgis", "postgis_topology"],

        "tables": {
            "floats": {
                "description": "Stores metadata for each float.",
                "columns": {
                    "wmo": "BIGINT PRIMARY KEY",
                    "dac": "TEXT NOT NULL",
                    "first_profile_time": "TIMESTAMPTZ",
                    "last_profile_time": "TIMESTAMPTZ",
                    "meta_json": "JSONB",
                    "created_at": "TIMESTAMPTZ DEFAULT now()",
                    "updated_at": "TIMESTAMPTZ DEFAULT now()"
                }
            },

            "float_cycles": {
                "description": "One row per float cycle, linked to floats by wmo.",
                "columns": {
                    "id": "BIGSERIAL PRIMARY KEY",
                    "wmo": "BIGINT NOT NULL REFERENCES floats(wmo) ON UPDATE CASCADE",
                    "cycle_number": "INTEGER NOT NULL",
                    "inserted_at": "TIMESTAMPTZ DEFAULT now()",
                    "updated_at": "TIMESTAMPTZ DEFAULT now()"
                },
                "constraints": [
                    "UNIQUE (wmo, cycle_number)"
                ],
                "indexes": [
                    {"name": "float_cycles_idx", "columns": ["wmo", "cycle_number"]}
                ]
            },

            "profiles": {
                "description": "Per-profile data for each float cycle, including metadata, QC info, and spatial location.",
                "columns": {
                    "id": "BIGSERIAL PRIMARY KEY",
                    "cycle_id": "BIGINT NOT NULL REFERENCES float_cycles(id) ON DELETE CASCADE",

                    "data_mode": "TEXT",
                    "juld_time": "TIMESTAMPTZ",
                    "latitude": "DOUBLE PRECISION",
                    "longitude": "DOUBLE PRECISION",

                    "file_type": "TEXT",
                    "source_file": "TEXT",
                    "source_path": "TEXT",

                    "global_attrs": "JSONB",
                    "has_adjusted_core": "BOOLEAN",
                    "qc_summary": "JSONB",

                    "direction": "TEXT",
                    "vertical_sampling_scheme": "TEXT",
                    "profile_index": "INTEGER",
                    "n_core_levels": "INTEGER",
                    "max_pres": "DOUBLE PRECISION",

                    "modality": "TEXT",

                    "inserted_at": "TIMESTAMPTZ DEFAULT now()",
                    "updated_at": "TIMESTAMPTZ DEFAULT now()",

                    # PostGIS generated column
                    "geom": {
                        "type": "geometry(Point,4326)",
                        "generated": "ALWAYS",
                        "storage": "STORED",
                        "expression": "ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)",
                        "notes": "Derived from (longitude, latitude) as WGS84 point"
                    }
                },
                "indexes": [
                    {"name": "profiles_time_idx", "columns": ["juld_time"]},
                    {"name": "profiles_geo_idx",  "columns": ["latitude", "longitude"]},
                    {
                        "name": "profiles_geom_gix",
                        "using": "GIST",
                        "columns": ["geom"],
                        "where": "geom IS NOT NULL"
                    }
                ],
                "constraints": [
                    {
                        "type": "UNIQUE",
                        "name": "profiles_cycle_modality_idx_uq",
                        "columns": ["cycle_id", "modality", "profile_index"]
                    }
                ],
                "migration_notes": [
                    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS modality TEXT;",
                    "UPDATE profiles SET modality = CASE WHEN file_type = 'bgc_sprof' THEN 'bgc' ELSE 'core' END WHERE modality IS NULL;",
                    "DROP INDEX IF EXISTS profiles_cycle_idx_uq;"
                ]
            },

            "levels_core": {
                "description": "Per-profile core measurement levels (temperature, salinity, etc.).",
                "columns": {
                    "profile_id": "BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE",
                    "level_index": "INTEGER NOT NULL",

                    "pres": "DOUBLE PRECISION",
                    "pres_qc": "TEXT",

                    "temp": "DOUBLE PRECISION",
                    "temp_qc": "TEXT",
                    "best_temp": "DOUBLE PRECISION",

                    "psal": "DOUBLE PRECISION",
                    "psal_qc": "TEXT",
                    "best_psal": "DOUBLE PRECISION"
                },
                "primary_key": ["profile_id", "level_index"]
            },

            "levels_bgc": {
                "description": "Per-profile BGC measurement levels (oxygen, chlorophyll-a, etc.).",
                "columns": {
                    "profile_id": "BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE",
                    "level_index": "INTEGER NOT NULL",

                    "pres": "DOUBLE PRECISION",

                    "doxy": "DOUBLE PRECISION",
                    "doxy_qc": "TEXT",

                    "chla": "DOUBLE PRECISION",
                    "chla_qc": "TEXT",
                },
                "primary_key": ["profile_id", "level_index"]
            }
        },

        "views": {
            "levels_bgc_best": {
                "description": "Convenience view exposing best-available BGC values per level.",
                "definition": (
                    "SELECT profile_id, level_index, pres, "
                    "COALESCE(doxy_adjusted, doxy) AS best_doxy, "
                    "COALESCE(chla_adjusted, chla) AS best_chla "
                    "FROM levels_bgc"
                ),
                "columns": {
                    "profile_id": "BIGINT",
                    "level_index": "INTEGER",
                    "pres": "DOUBLE PRECISION",
                    "best_doxy": "DOUBLE PRECISION",
                    "best_chla": "DOUBLE PRECISION"
                }
            }
        },

        "relationships": [
            {"from": "float_cycles.wmo", "to": "floats.wmo", "on_update": "CASCADE"},
            {"from": "profiles.cycle_id", "to": "float_cycles.id", "on_delete": "CASCADE"},
            {"from": "levels_core.profile_id", "to": "profiles.id", "on_delete": "CASCADE"},
            {"from": "levels_bgc.profile_id", "to": "profiles.id", "on_delete": "CASCADE"}
        ]
    }
@mcp.tool()
async def generate_time_series_tool(payload:dict):
    from tools.time_series_api import TimeSeriesPayload, generate_time_series
    params = TimeSeriesPayload(
        payload=payload,
        output="html",
        title="Temperature over time")
    result = await generate_time_series(params)
    
    html_content = result["plot"]
    filename = f"{uuid.uuid4().hex}.html"
    PLOT_DIR = "C:\\Users\\amaan\\Desktop\\Projects\\floatchart\\FloatChat_DebugDynasty_SiH\\core\\llm\\plots"
    file_path = os.path.join(PLOT_DIR, filename)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    # Return a URL pointing to the served file
    return {"plot_url": f"http://localhost:7500/plots/{filename}"}


if __name__ == "__main__":
    mcp.run(transport="http", port=8000)
