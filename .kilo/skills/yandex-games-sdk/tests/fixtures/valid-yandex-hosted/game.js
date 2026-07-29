const ysdk = await YaGames.init().catch(console.error);
ysdk.features?.LoadingAPI?.ready();
ysdk.features?.GameplayAPI?.start();
