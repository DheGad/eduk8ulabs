import { createRoot } from "react-dom/client";
import Popup from "./Popup";

const container = document.getElementById("root");
if (!container) throw new Error("[V94] Popup mount point #root not found.");
createRoot(container).render(<Popup />);
