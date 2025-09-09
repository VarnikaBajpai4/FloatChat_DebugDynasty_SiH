import psycopg2
from psycopg2.extras import RealDictCursor
from config import PG_DSN

def connect_pg():
    return psycopg2.connect(PG_DSN)

def fetch_profiles(conn, batch=50000):
   with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            WITH vars AS (
              SELECT p.id AS profile_id,
                     BOOL_OR(lb.doxy IS NOT NULL) AS has_doxy,
                     BOOL_OR(lb.chla IS NOT NULL) AS has_chla
              FROM profiles p
              LEFT JOIN levels_bgc lb ON lb.profile_id = p.id
              GROUP BY p.id
            )
            SELECT
                p.id,
                fc.wmo,
                fc.cycle_number,
                p.modality,
                p.data_mode,
                p.juld_time,
                p.latitude,
                p.longitude,
                p.file_type,
                p.has_adjusted_core,
                p.max_pres,
                COALESCE(v.has_doxy,false) AS has_doxy,
                COALESCE(v.has_chla,false) AS has_chla
            FROM profiles p
            JOIN float_cycles fc ON fc.id = p.cycle_id
            JOIN floats f ON f.wmo = fc.wmo
            LEFT JOIN vars v ON v.profile_id = p.id
            ORDER BY p.id
            LIMIT %s;
        """, (batch,))
        return cur.fetchall()

def fetch_floats(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            WITH prof AS (
              SELECT
                p.id, p.juld_time, p.latitude, p.longitude, p.max_pres, fc.wmo
              FROM profiles p
              JOIN float_cycles fc ON fc.id = p.cycle_id
            ),
            agg AS (
              SELECT
                wmo,
                MIN(juld_time) AS first_t,
                MAX(juld_time) AS last_t,
                COUNT(*) AS n_profiles,
                MAX(max_pres) AS max_pres_ever
              FROM prof
              GROUP BY wmo
            ),
            lastpos AS (
              SELECT DISTINCT ON (wmo)
                wmo, latitude AS last_lat, longitude AS last_lon, juld_time AS last_t
              FROM prof
              ORDER BY wmo, juld_time DESC
            )
            SELECT
              f.wmo, f.dac,
              a.n_profiles, a.first_t, a.last_t,
              lp.last_lat, lp.last_lon,
              a.max_pres_ever
            FROM floats f
            JOIN agg a ON a.wmo = f.wmo
            LEFT JOIN lastpos lp ON lp.wmo = f.wmo
            ORDER BY f.wmo;
        """)
        return cur.fetchall()
