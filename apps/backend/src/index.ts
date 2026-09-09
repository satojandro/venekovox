import "dotenv/config";
import app from "./app";

const PORT = process.env.PORT || 3100;

app.listen(PORT, () => {
  console.log(`VenekoVox backend on http://localhost:${PORT}`);
  console.log(`Legacy Self Pass: POST /verify`);
  console.log(`ZKPassport eligibility: /eligibility/health`);
  console.log(`Configured poll window: GET /polls/configured`);
});
