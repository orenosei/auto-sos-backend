import express from 'express';
    
import { getAllCompanies, 
    getCompanyById, 
    createCompany, 
    updateCompany, 
    deleteCompany } from '../controllers/companiesController.js';

import {
    getCompanyServices,
    addCompanyService,
    updateCompanyService,
    deleteCompanyService,
} from '../controllers/companyServicesController.js';

const router = express.Router();

router.get('/', getAllCompanies);
router.get('/:id', getCompanyById);

// Company services (company_services)
router.get('/:id/services', getCompanyServices);
router.post('/:id/services', addCompanyService);
router.put('/:id/services/:service_id', updateCompanyService);
router.delete('/:id/services/:service_id', deleteCompanyService);

router.post('/', createCompany);
router.put('/:id', updateCompany);
router.delete('/:id', deleteCompany);

export default router;