import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import * as transactionController from '../controllers/transactionController.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', transactionController.getTransactions);
router.get('/:id', transactionController.getTransaction);
router.post('/', transactionController.addTransaction);
router.put('/:id', transactionController.updateTransaction);
router.delete('/:id', transactionController.deleteTransaction);
router.get('/stats', transactionController.getTransactionStats);
router.get('/category/:category', transactionController.getTransactionsByCategory);

export default router;