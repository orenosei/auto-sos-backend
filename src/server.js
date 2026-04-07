import express from 'express';
import cors from "cors";
import dotenv from 'dotenv';

import companiesRoutes from './routes/companiesRoutes.js';
import usersRoutes from './routes/usersRoutes.js';
import authRoutes from './routes/authRoutes.js';
import servicesRoutes from './routes/servicesRoutes.js';
import vehiclesRoutes from './routes/vehiclesRoutes.js';

dotenv.config();

const PORT = process.env.PORT || 5001;

const app = express();

// Cho phép Express đọc JSON gửi từ client/Postman
app.use(express.json());

//  test qua frontend hoặc localhost khác cổng
app.use(cors());

// Sử dụng routes
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/vehicles', vehiclesRoutes);


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

