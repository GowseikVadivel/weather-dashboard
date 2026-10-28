(() => {
  "use strict";

  const CITIES = ["New Delhi", "Mumbai", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune", "Patna", "Jaipur", "London"];
  const MOOD_STYLES = {
    Scorching: { emoji: "☀", description: "Very high heat. Hydrate, seek shade, and limit time outdoors.", className: "mood-scorching" },
    Freezing: { emoji: "❄", description: "A sharp chill in the air. Add a warm layer before heading out.", className: "mood-freezing" },
    Muggy: { emoji: "≋", description: "Warm and humid. It may feel sticky, so take it easy outside.", className: "mood-muggy" },
    Windy: { emoji: "↝", description: "A strong breeze is in charge today. Secure light items outdoors.", className: "mood-windy" },
    Pleasant: { emoji: "✳", description: "Mild, dry, and calm. A lovely combination for being outside.", className: "mood-pleasant" },
    Comfortable: { emoji: "◒", description: "Conditions look fairly balanced. A comfortable day for most plans.", className: "mood-comfortable" },
    Mixed: { emoji: "◌", description: "A little of everything. Check the details before heading out.", className: "mood-mixed" }
  };

  // Rules are evaluated in this exact order; first match wins.
  function getMood(tempC, humidity, windKph) {
    if (tempC >= 38) return "Scorching";
    if (tempC <= 5) return "Freezing";
    if (humidity >= 80 && tempC >= 28) return "Muggy";
    if (windKph >= 30) return "Windy";
    if (tempC >= 20 && tempC <= 30 && humidity <= 60 && windKph <= 20) return "Pleasant";
    if (tempC >= 15 && tempC <= 30 && humidity <= 75 && windKph <= 30) return "Comfortable";
    return "Mixed";
  }

  const $ = (id) => document.getElementById(id);
  const form = $("search-form");
  const input = $("city-input");
  const searchButton = $("search-button");
  const status = $("status");
  const weatherSection = $("weather-section");
  const chipsContainer = $("city-chips");
  const jsonContent = $("json-content");
  const jsonView = $("json-view");
  const copyButton = $("copy-json");
  let currentRawBody = "";
  let currentParsed = null;
  let mode = "raw";
  let requestSequence = 0;
  let selectedCity = "";

  CITIES.forEach((city) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "city-chip";
    chip.textContent = city;
    chip.dataset.city = city;
    chip.addEventListener("click", () => {
      input.value = city;
      fetchWeather(city);
    });
    chipsContainer.appendChild(chip);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const city = input.value.trim();
    if (!city) {
      setStatus("Enter a city name to search.", "error");
      input.focus();
      return;
    }
    fetchWeather(city);
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      mode = tab.dataset.mode;
      document.querySelectorAll(".tab").forEach((item) => {
        const active = item === tab;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });
      renderJson();
    });
  });

  copyButton.addEventListener("click", async () => {
    if (!currentRawBody) return;
    try {
      await navigator.clipboard.writeText(currentRawBody);
      copyButton.innerHTML = "<span aria-hidden='true'>✓</span> Copied";
      window.setTimeout(() => { copyButton.innerHTML = "<span aria-hidden='true'>▢</span> Copy JSON"; }, 1400);
    } catch (_) {
      const range = document.createRange();
      range.selectNodeContents(jsonContent);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      setStatus("Clipboard access was blocked. Select the response text and copy it manually.", "error");
    }
  });

  function setStatus(message, state = "") {
    status.textContent = message;
    status.className = "status" + (state ? " " + state : "");
  }

  function selectChip(city) {
    selectedCity = city.toLocaleLowerCase();
    document.querySelectorAll(".city-chip").forEach((chip) => {
      const active = chip.dataset.city.toLocaleLowerCase() === selectedCity;
      chip.classList.toggle("selected", active);
      chip.setAttribute("aria-pressed", String(active));
    });
  }

  function updateJson(body, parsed) {
    currentRawBody = body;
    currentParsed = parsed;
    copyButton.disabled = !body;
    $("json-status").textContent = parsed === null ? "NON-JSON RESPONSE" : "LATEST RESPONSE";
    $("json-size").textContent = new TextEncoder().encode(body).length.toLocaleString() + " bytes";
    renderJson();
  }

  function renderJson() {
    if (!currentRawBody) {
      jsonContent.textContent = "Search for a city to inspect its API response.";
      return;
    }
    if (mode === "raw" || currentParsed === null) {
      // textContent ensures raw upstream content is displayed safely, not executed as HTML.
      jsonContent.textContent = currentRawBody;
      return;
    }
    const pretty = JSON.stringify(currentParsed, null, 2);
    const escaped = escapeHtml(pretty);
    const highlighted = escaped.replace(
      /("(?:\\.|[^"\\])*"(?=\\s*:)|"(?:\\.|[^"\\])*"|\\b(?:true|false)\\b|\\bnull\\b|-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)/g,
      (token) => {
        let cls = "token-number";
        if (token.startsWith('"')) cls = /:\s*$/.test(token) ? "token-key" : "token-string";
        else if (token === "true" || token === "false") cls = "token-boolean";
        else if (token === "null") cls = "token-null";
        return '<span class="' + cls + '">' + token + "</span>";
      }
    );
    jsonContent.innerHTML = highlighted;
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
  }

  async function fetchWeather(city) {
    const cleanCity = city.trim();
    if (!cleanCity) {
      setStatus("Enter a city name to search.", "error");
      return;
    }
    const sequence = ++requestSequence;
    selectChip(cleanCity);
    searchButton.disabled = true;
    searchButton.textContent = "Searching…";
    setStatus("Finding current conditions for " + cleanCity + "…", "loading");
    updateJson("", null);
    $("json-status").textContent = "REQUEST IN PROGRESS";
    $("json-size").textContent = "—";

    try {
      const response = await fetch("/api/weather?city=" + encodeURIComponent(cleanCity), {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });
      const body = await response.text();
      if (sequence !== requestSequence) return;
      let parsed = null;
      try { parsed = JSON.parse(body); } catch (_) {}
      updateJson(body, parsed);

      if (!response.ok) {
        const upstreamMessage = parsed && parsed.error && parsed.error.message;
        const message = parsed && parsed.error && typeof parsed.error === "string" ? parsed.error :
          upstreamMessage || (response.status === 404 ? "City not found. Check the spelling and try again." :
          response.status === 429 ? "Too many requests. Please wait a moment and retry." :
          response.status >= 500 ? "The weather service is temporarily unavailable. Try again shortly." :
          "Could not fetch weather. Please check the city and try again.");
        weatherSection.hidden = true;
        setStatus(message, "error");
        return;
      }
      if (!parsed || !parsed.location || !parsed.current) {
        weatherSection.hidden = true;
        setStatus("The weather service returned an unexpected response. Please retry.", "error");
        return;
      }
      renderWeather(parsed);
      setStatus("Current conditions loaded for " + parsed.location.name + ".", "");
    } catch (_) {
      if (sequence !== requestSequence) return;
      weatherSection.hidden = true;
      updateJson(JSON.stringify({ error: "Network error. Check your connection and try again." }, null, 2),
        { error: "Network error. Check your connection and try again." });
      setStatus("Network error. Check your connection and try again.", "error");
    } finally {
      if (sequence === requestSequence) {
        searchButton.disabled = false;
        searchButton.innerHTML = 'Search <span aria-hidden="true">↗</span>';
      }
    }
  }

  function renderWeather(data) {
    const location = data.location;
    const current = data.current;
    const temp = Number(current.temp_c);
    const humidity = Number(current.humidity);
    const wind = Number(current.wind_kph);
    const mood = getMood(temp, humidity, wind);
    const style = MOOD_STYLES[mood];

    $("location-name").textContent = location.name || "Unknown location";
    $("location-detail").textContent = [location.region, location.country].filter(Boolean).join(", ");
    $("local-time").textContent = location.localtime ? location.localtime.split(" ")[1] : "—";
    $("local-date").textContent = location.localtime ? formatLocalDate(location.localtime) : "Local date unavailable";
    $("temperature").textContent = Number.isFinite(temp) ? Math.round(temp) : "—";
    $("condition-text").textContent = current.condition && current.condition.text || "Condition unavailable";
    const iconPath = current.condition && current.condition.icon;
    $("condition-icon").src = iconPath ? (iconPath.startsWith("//") ? "https:" + iconPath : iconPath) : "";
    $("condition-icon").alt = current.condition && current.condition.text ? current.condition.text : "Weather condition";
    $("feels-like").textContent = "Feels like " + numberOrDash(current.feelslike_c, 1) + "°C";
    $("humidity").textContent = numberOrDash(current.humidity, 0);
    $("humidity-bar").style.width = clamp(current.humidity, 0, 100) + "%";
    $("wind").textContent = numberOrDash(current.wind_kph, 1);
    $("wind-direction").textContent = [current.wind_dir, "wind"].filter(Boolean).join(" ");
    $("uv").textContent = numberOrDash(current.uv, 1);
    $("uv-description").textContent = uvDescription(Number(current.uv));
    $("cloud").textContent = numberOrDash(current.cloud, 0);
    $("cloud-bar").style.width = clamp(current.cloud, 0, 100) + "%";
    $("mood-panel").className = "mood-panel " + style.className;
    $("mood-emoji").textContent = style.emoji;
    $("mood-name").textContent = mood;
    $("mood-description").textContent = style.description;
    $("last-updated").textContent = current.last_updated ? "Weather data updated " + current.last_updated : "";
    weatherSection.hidden = false;
  }

  function formatLocalDate(value) {
    const parts = value.split(" ")[0].split("-");
    if (parts.length !== 3) return value;
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }
  function numberOrDash(value, decimals) {
    const n = Number(value);
    return value !== null && value !== undefined && value !== "" && Number.isFinite(n) ? n.toFixed(decimals) : "—";
  }
  function clamp(value, min, max) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
  }
  function uvDescription(uv) {
    if (!Number.isFinite(uv)) return "Sun exposure level";
    if (uv < 3) return "Low exposure";
    if (uv < 6) return "Moderate exposure";
    if (uv < 8) return "High exposure";
    if (uv < 11) return "Very high exposure";
    return "Extreme exposure";
  }

  // Expose pure function for lightweight automated/manual threshold testing.
  window.AtmosMood = { getMood };
  selectChip("");
})();