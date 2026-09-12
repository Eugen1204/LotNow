from contextlib import asynccontextmanager
from fastapi import FastAPI
from routers.auth import router
from routers.lots import router as lots_router
from routers.bids import router as bids_router, process_bids, autocompletion
from routers.users import router as users_router
from routers.users import users_bids_router as users_bids_router
from database import init_db
import asyncio
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    asyncio.create_task(process_bids())
    asyncio.create_task(autocompletion())
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(lots_router)
app.include_router(bids_router)
app.include_router(users_router)
app.include_router(users_bids_router)