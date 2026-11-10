import logging
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

log = logging.getLogger(__name__)

is_sqlite = settings.database_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}
# Neon closes idle connections and scales compute to zero, so recycle pooled
# connections and verify them before use to avoid stale-connection errors.
pool_kwargs = {} if is_sqlite else {"pool_pre_ping": True, "pool_recycle": 300}
engine = create_engine(settings.database_url, connect_args=connect_args, future=True, **pool_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Column type names that both PostgreSQL and SQLite accept, for add_missing_columns.
_DDL_TYPES = {
    "VARCHAR": "VARCHAR(128)", "FLOAT": "DOUBLE PRECISION", "INTEGER": "INTEGER",
}

def add_missing_columns():
    """Add columns declared on the models but absent from the live tables.

    `create_all` only creates whole tables, so new fields on an existing table
    are invisible without this. It is not a substitute for Alembic — it only
    ever adds nullable columns and never drops or retypes anything.
    """
    inspector = inspect(engine)
    added = []
    for table in Base.metadata.sorted_tables:
        if table.name not in inspector.get_table_names():
            continue
        existing = {c["name"] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing:
                continue
            base = column.type.__class__.__name__.upper()
            if base in ("VARCHAR", "STRING", "TEXT"):
                ddl_type = "TEXT"
            elif base == "FLOAT":
                ddl_type = "DOUBLE PRECISION" if not is_sqlite else "REAL"
            elif base == "INTEGER":
                ddl_type = "INTEGER"
            elif base == "BOOLEAN":
                ddl_type = "BOOLEAN"
            else:
                log.warning("Skipping %s.%s: unmapped type %s", table.name, column.name, base)
                continue
            with engine.begin() as conn:
                conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN {column.name} {ddl_type}'))
            added.append(f"{table.name}.{column.name}")
    if added:
        log.info("Added missing columns: %s", ", ".join(added))
    return added
