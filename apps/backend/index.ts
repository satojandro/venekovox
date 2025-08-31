import app from './app';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ VenekoVox backend server running on http://localhost:${PORT}`);
  console.log(`🔗 Self.xyz verification endpoint: http://localhost:${PORT}/verify`);
});
