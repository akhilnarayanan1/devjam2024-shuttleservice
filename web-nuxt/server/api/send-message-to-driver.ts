// keys present in filter will be removed from the query parsing
const objectToQueryString = (obj: Record<string, any>, filterKeys: Array<string>): string => {
  const filteredObj = Object.fromEntries(
    Object.entries(obj).filter(([key]) => !filterKeys.includes(key))
  );

  return Object.entries(filteredObj)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export default defineEventHandler(async (event) => {
    const body = await readBody(event);

    if (body["origin"] === "" || body["destination"] === "" ||
        body["origin_place_id"] === "" || body["destination_place_id"] === "" ||
        body["originShortName"] === "" || body["destinationShortName"] === "") {
        throw createError({
          statusCode: 422,
          statusMessage: "Necessary parameters not present"
        });
    }

    const { GRAPH_API_VERSION, GRAPH_API_TOKEN, BUSINESS_WA_NO, ONE_DRIVER } = useRuntimeConfig(event);
    const API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${BUSINESS_WA_NO}/messages`

    const query_parsed = objectToQueryString(body, ["originShortName", "destinationShortName"]);

    const repo = await $fetch(API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GRAPH_API_TOKEN}`
        },
        body: {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": ONE_DRIVER.toString(),
            "type": "interactive",
            "interactive": {
              "type": "cta_url",
              /* Body optional */
              "body": {
                "text": `🚀 Route plan 🚀\n\n📍*${body.originShortName}* ➡️ 📍*${body.destinationShortName}*\n\nLet's go! 🚗💨`,
              },
              "action": {
                "name": "cta_url",
                "parameters": {
                  "display_text": "OPEN MAPS",
                  "url": `https://www.google.com/maps/dir/?api=1&${query_parsed}`
                }
              }
            }
          }
    })

    return repo;
});
  