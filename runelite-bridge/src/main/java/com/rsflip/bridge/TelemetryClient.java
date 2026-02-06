package com.rsflip.bridge;

import com.google.gson.Gson;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.util.Map;

public class TelemetryClient
{
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    private final OkHttpClient http = new OkHttpClient();
    private final Gson gson = new Gson();

    public void postJson(String url, String bearerToken, Map<String, Object> payload) throws Exception
    {
        String bodyStr = gson.toJson(payload);

        RequestBody body = RequestBody.create(bodyStr, JSON);
        Request req = new Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer " + bearerToken)
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build();

        try (Response res = http.newCall(req).execute())
        {
            // Non-2xx is still useful to log, but we’ll just throw to keep it obvious during dev.
            if (!res.isSuccessful())
            {
                throw new RuntimeException("HTTP " + res.code() + " from " + url);
            }
        }
    }
}
