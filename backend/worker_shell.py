from workers import WorkerEntrypoint


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return Response.new(
            '{"service":"jamissue-api","status":"shell-ready","message":"Worker shell is live. Configure secrets and replace with the FastAPI entrypoint next."}',
            headers={"content-type": "application/json; charset=utf-8"},
        )
