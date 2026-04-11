import pymysql
import re
from pymysql.constants import CLIENT

print("Binabasa ang schema.sql...")
with open('migrations/schema.sql', 'r', encoding='utf-8') as file:
    sql_script = file.read()

# Tanggalin ang commands na bawal sa Railway
sql_script = sql_script.replace("CREATE DATABASE IF NOT EXISTS smartqualihome;", "")
sql_script = sql_script.replace("USE smartqualihome;", "")

# Railway-managed MySQL variants may not support these clauses in ALTER TABLE.
# We remove them and handle idempotent behavior through error-code skipping below.
sql_script = re.sub(
    r"\bADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b",
    "ADD COLUMN",
    sql_script,
    flags=re.IGNORECASE,
)
sql_script = re.sub(
    r"\bDROP\s+COLUMN\s+IF\s+EXISTS\b",
    "DROP COLUMN",
    sql_script,
    flags=re.IGNORECASE,
)

print("Kumokonekta sa Railway Database...")
conn = pymysql.connect(
    host='maglev.proxy.rlwy.net',
    user='root',
    password='PzpYLXLyJnZKTtnxoWVVWoMZNuQDNPvP',
    port=36548,
    database='railway',
    client_flag=CLIENT.MULTI_STATEMENTS  # Ito ang sikreto para ma-run lahat ng tables sabay-sabay!
)

try:
    cursor = conn.cursor()
    print("Ginagawa na ang mga tables (Please wait)...")

    statements = [stmt.strip() for stmt in sql_script.split(';') if stmt.strip()]
    skip_error_codes = {
        1060,  # Duplicate column name
        1091,  # Can't DROP column; check that column/key exists
        1050,  # Table already exists
        1061,  # Duplicate key name
    }

    for idx, statement in enumerate(statements, start=1):
        try:
            cursor.execute(statement)
        except pymysql.MySQLError as sql_err:
            error_code = sql_err.args[0] if sql_err.args else None
            if error_code in skip_error_codes:
                print(f"Skip stmt #{idx} (idempotent): {error_code} - {sql_err}")
                continue
            raise

    conn.commit()
    print("SUCCESS! Gawa na lahat ng tables sa Railway!")
except Exception as e:
    print("May error:", e)
finally:
    conn.close()