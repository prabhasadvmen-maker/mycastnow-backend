import axios from 'axios';
async function run() {
  try {
    const res = await axios.get('https://pub-advmenngo.r2.dev/portfolio/1790511364336-354192657.png');
    console.log("Success! Status:", res.status);
  } catch (err) {
    console.log("Error status:", err.response?.status);
    console.log("Error data:", err.response?.data);
  }
  process.exit();
}
run();
