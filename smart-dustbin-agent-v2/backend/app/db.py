from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

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
