import express from 'express';
    
import { getAllCompanies, 
    getCompanyById, 
    createCompany, 
    updateCompany, 
    changeCompanyPassword,
    deleteCompany,
    getNearbyCompanies,
    getCompaniesRatings,
    recommendCompany } from '../controllers/companiesController.js';

import {
    getCompanyServices,
    addCompanyService,
    updateCompanyService,
    deleteCompanyService,
} from '../controllers/companyServicesController.js';
import { getCompanyReviews, getCompanyRating } from '../controllers/reviewsController.js';

const router = express.Router();

router.get('/', getAllCompanies);
router.get('/nearby', getNearbyCompanies); // Phải nằm trước /:id để tránh xung đột
router.get('/ratings', getCompaniesRatings); // batch ratings for multiple ids
router.post('/recommend', recommendCompany);
router.get('/:id', getCompanyById);

// Company services (company_services)
router.get('/:id/services', getCompanyServices);
router.post('/:id/services', addCompanyService);
router.put('/:id/services/:service_id', updateCompanyService);
router.delete('/:id/services/:service_id', deleteCompanyService);

// Reviews and rating
router.get('/:id/reviews', getCompanyReviews);
router.get('/:id/rating', getCompanyRating);

router.post('/', createCompany);
router.put('/:id/password', changeCompanyPassword);
router.put('/:id', updateCompany);
router.delete('/:id', deleteCompany);

export default router;
