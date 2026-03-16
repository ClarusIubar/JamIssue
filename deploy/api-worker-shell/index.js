export default {
  async fetch(request, env) {
    return new Response(
      JSON.stringify({
        service: 'jamissue-api',
        status: 'shell-ready',
        frontendUrl: env.APP_FRONTEND_URL ?? null,
        callbackUrl: env.APP_NAVER_LOGIN_CALLBACK_URL ?? null,
        message: 'API worker shell is live. Add secrets next, then replace this shell with the FastAPI-backed implementation.'
      }, null, 2),
      {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store'
        }
      }
    );
  }
};
