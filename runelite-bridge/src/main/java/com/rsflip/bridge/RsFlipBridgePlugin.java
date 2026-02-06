package com.rsflip.bridge;

import com.google.inject.Provides;
import lombok.extern.slf4j.Slf4j;
import net.runelite.api.Client;
import net.runelite.client.config.ConfigManager;
import net.runelite.client.plugins.Plugin;
import net.runelite.client.plugins.PluginDescriptor;

import javax.inject.Inject;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Slf4j
@PluginDescriptor(
    name = "RS Flip Bridge",
    description = "Posts local telemetry (heartbeat) to RS Flip Tool backend",
    tags = {"ge", "flipping", "telemetry", "bridge"}
)
public class RsFlipBridgePlugin extends Plugin
{
    private static final String HEARTBEAT_PATH = "/api/telemetry/heartbeat";

    @Inject
    private Client client;

    @Inject
    private ScheduledExecutorService executor;

    @Inject
    private RsFlipBridgeConfig config;

    private final TelemetryClient telemetryClient = new TelemetryClient();
    private ScheduledFuture<?> heartbeatTask;

    @Provides
    RsFlipBridgeConfig provideConfig(ConfigManager configManager)
    {
        return configManager.getConfig(RsFlipBridgeConfig.class);
    }

    @Override
    protected void startUp()
    {
        scheduleHeartbeat();
        log.info("RS Flip Bridge started");
    }

    @Override
    protected void shutDown()
    {
        if (heartbeatTask != null)
        {
            heartbeatTask.cancel(true);
            heartbeatTask = null;
        }
        log.info("RS Flip Bridge stopped");
    }

    private void scheduleHeartbeat()
    {
        int sec = config.heartbeatSeconds();
        if (sec < 10) sec = 10;
        if (sec > 30) sec = 30;

        if (heartbeatTask != null)
        {
            heartbeatTask.cancel(true);
        }

        final int interval = sec;
        heartbeatTask = executor.scheduleAtFixedRate(() -> {
            try
            {
                sendHeartbeat();
            }
            catch (Exception e)
            {
                // Don’t crash plugin; just log.
                log.warn("Heartbeat failed: {}", e.getMessage());
            }
        }, 2, interval, TimeUnit.SECONDS);
    }

    private void sendHeartbeat() throws Exception
    {
        // RuneLite provides a stable account hash (long). We’ll send hex to keep it consistent as a string key.
        long accountHashLong = client.getAccountHash();
        String accountHash = Long.toHexString(accountHashLong);

        Map<String, Object> payload = new HashMap<>();
        payload.put("schemaVersion", 1);
        payload.put("ts", System.currentTimeMillis());
        payload.put("accountHash", accountHash);

        // Best-effort extras (safe to omit server-side)
        payload.put("clientRevision", client.getRevision());
        payload.put("world", client.getWorld());
        payload.put("pluginVersion", this.getClass().getPackage().getImplementationVersion());

        String base = config.apiBaseUrl().trim();
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);

        String url = base + HEARTBEAT_PATH;

        telemetryClient.postJson(url, config.bridgeToken(), payload);
        log.debug("Heartbeat ok -> {}", url);
    }
}
