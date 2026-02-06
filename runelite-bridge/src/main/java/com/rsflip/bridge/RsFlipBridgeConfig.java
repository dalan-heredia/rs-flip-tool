package com.rsflip.bridge;

import net.runelite.client.config.Config;
import net.runelite.client.config.ConfigGroup;
import net.runelite.client.config.ConfigItem;

@ConfigGroup("rsflipbridge")
public interface RsFlipBridgeConfig extends Config
{
    @ConfigItem(
        keyName = "apiBaseUrl",
        name = "API Base URL",
        description = "Local RS Flip Tool API base URL",
        position = 1
    )
    default String apiBaseUrl()
    {
        return "http://127.0.0.1:8787";
    }

    @ConfigItem(
        keyName = "bridgeToken",
        name = "Bridge Token",
        description = "Shared secret token (Bearer). Must match API BRIDGE_TOKEN env var.",
        position = 2
    )
    default String bridgeToken()
    {
        return "dev-bridge-token";
    }

    @ConfigItem(
        keyName = "heartbeatSeconds",
        name = "Heartbeat Seconds",
        description = "How often to send heartbeat (10–30s recommended).",
        position = 3
    )
    default int heartbeatSeconds()
    {
        return 15;
    }
}
