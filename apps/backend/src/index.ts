import "dotenv/config";
import app from "./app";

const PORT = process.env.PORT || 3100;

app.listen(PORT, () => {
  console.log(`🚀 VenekoVox Backend Server running on port ${PORT}`);
  console.log(`📱 Self.xyz verification endpoint: http://localhost:${PORT}/verify`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🗳️  Configured poll window: http://localhost:${PORT}/polls/configured`);
});
