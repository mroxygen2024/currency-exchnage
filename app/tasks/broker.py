import taskiq_redis
from taskiq import AsyncBroker, InMemoryBroker, TaskiqScheduler
from taskiq.schedule_sources import LabelScheduleSource

from app.core.config import settings

# Define the broker using redis list queues.
# If in testing mode, we can use an InMemoryBroker to avoid requiring a running Redis instance.
if settings.ENV == "testing":
    broker = InMemoryBroker()
else:
    broker = taskiq_redis.ListQueueBroker(
        settings.redis_url,
        queue_name="currency_tracker_tasks",
    )

# Define the scheduler to enable periodic/scheduled tasks (mimicking Celery Beat)
scheduler = TaskiqScheduler(
    broker=broker,
    sources=[LabelScheduleSource(broker)],
)

# Register the FastAPI application target to allow tasks to resolve
# FastAPI dependencies (like Database sessions and Redis clients) directly.
# This requires running: taskiq worker app.tasks.broker:broker --fs-discover

