import dotenv from "dotenv";

import app from "./app.js";
import { expirePendingRequests } from "./repositories/requestRepository.js";

dotenv.config();

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const expirationTimer = setInterval(() => {
  expirePendingRequests().catch((error) => {
    console.error("Failed to expire pending rescue requests:", error);
  });
}, 60 * 1000);

expirationTimer.unref?.();
