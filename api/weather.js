const ALLOWED_METHODS = ["GET"];

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");

  if (!ALLOWED_METHODS.includes(req.method)) {
    res.setHeader("Allow", ALLOWED_METHODS.join(", "));
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
  if (!city) return res.status(400).json({ error: "Enter a city to search." });
  if (city.length > 100 || /[\u0000-\u001F\u007F]/.test(city)) {
    return res.status(400).json({ error: "City name is invalid or too long." });
  }

  const key = process.env.WEATHERAPI_KEY;
  if (!key) {
    return res.status(500).json({
      error: "Weather service is not configured. Add WEATHERAPI_KEY in the deployment environment."
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const url = new URL("https://api.weatherapi.com/v1/current.json");
    url.searchParams.set("key", key);
    url.searchParams.set("q", city);
    url.searchParams.set("aqi", "no");

    const upstream = await fetch(url.toString(), {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal
    });
    const body = await upstream.text();

    // WeatherAPI's response body is passed through without exposing the request URL/key.
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    return res.send(body);
  } catch (error) {
    const timedOut = error && error.name === "AbortError";
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? "The weather service took too long to respond. Try again." :
        "Could not reach the weather service. Check your connection and try again."
    });
  } finally {
    clearTimeout(timeout);
  }
};