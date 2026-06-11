import { findAllServices } from "../repositories/serviceRepository.js";

export const getAllServices = async (req, res) => {
  try {
    const services = await findAllServices();
    res.status(200).json({ success: true, data: services });
  } catch (error) {
    console.error("Error fetching services:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
