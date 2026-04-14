export default async function handler(req, res) {
    try {
      const { amount, currency } = req.query;
  
      const response = await fetch("https://merchant.revolut.com/api/orders", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.REVOLUT_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: Number(amount),
          currency: currency,
          capture_mode: "AUTOMATIC"
        })
      });
  
      const data = await response.json();
  
      return res.status(200).json({
        public_id: data.public_id
      });
  
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }