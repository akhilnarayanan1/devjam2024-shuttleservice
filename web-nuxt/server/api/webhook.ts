export default defineEventHandler((event) => {
    const query = getQuery(event);
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    const { WEBHOOK_VERIFY_TOKEN } = useRuntimeConfig(event);

    // check the mode and token sent are correct
    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
        // respond with 200 OK and challenge token from the request
        setResponseStatus(event, 200)   ;     
        return challenge;
    } else {
        // respond with '403 Forbidden' if verify tokens do not match
        setResponseStatus(event, 403);
        return { error: "Forbidden" }
    }

});
  