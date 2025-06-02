import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

// ...rest of the file unchanged...
// @desc    Get all transactions for logged in user
// @route   GET /api/transactions
// @access  Private
const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, type, startDate, endDate, sortBy = 'date', sortOrder = 'desc' } = req.query;
    
    // Build filter object
    const filter = { userId: req.user._id };
    
    if (category && category !== 'all') {
      filter.category = { $regex: category, $options: 'i' };
    }
    
    if (type && type !== 'all') {
      filter.type = type;
    }
    
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    if (sortBy !== 'createdAt') {
      sort.createdAt = -1; // Secondary sort by creation date
    }
    
    // Calculate skip value for pagination
    const skip = (page - 1) * parseInt(limit);
    
    // Get transactions with pagination
    const transactions = await Transaction.find(filter)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();
    
    // Get total count for pagination
    const total = await Transaction.countDocuments(filter);
    
    // Calculate summary statistics
    const summaryPipeline = [
      { $match: filter },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ];
    
    const summary = await Transaction.aggregate(summaryPipeline);
    
    const summaryData = {
      totalIncome: summary.find(s => s._id === 'income')?.total || 0,
      totalExpense: summary.find(s => s._id === 'expense')?.total || 0,
      totalTransactions: total
    };
    
    summaryData.balance = summaryData.totalIncome - summaryData.totalExpense;
    
    res.json({
      success: true,
      data: {
        transactions,
        summary: summaryData,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          hasNext: page < Math.ceil(total / parseInt(limit)),
          hasPrev: page > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
const getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    res.json({
      success: true,
      data: transaction
    });
    
  } catch (error) {
    console.error('Get transaction error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while fetching transaction'
    });
  }
};

// @desc    Add new transaction
// @route   POST /api/transactions
// @access  Private
const addTransaction = async (req, res) => {
  try {
    const { type, amount, category, description, date } = req.body;
    
    // Validation
    const errors = [];
    
    if (!type) errors.push('Transaction type is required');
    if (!amount) errors.push('Amount is required');
    if (!category) errors.push('Category is required');
    
    if (type && !['income', 'expense'].includes(type)) {
      errors.push('Type must be either income or expense');
    }
    
    if (amount && (isNaN(amount) || parseFloat(amount) <= 0)) {
      errors.push('Amount must be a positive number');
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    // Create transaction
    const transaction = new Transaction({
      userId: req.user._id,
      type,
      amount: parseFloat(amount),
      category: category.trim(),
      description: description?.trim() || '',
      date: date ? new Date(date) : new Date()
    });
    
    const savedTransaction = await transaction.save();
    
    res.status(201).json({
      success: true,
      message: 'Transaction added successfully',
      data: savedTransaction
    });
    
  } catch (error) {
    console.error('Add transaction error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while adding transaction'
    });
  }
};

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private
const updateTransaction = async (req, res) => {
  try {
    const { type, amount, category, description, date } = req.body;
    
    // Find transaction
    let transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    // Validation
    const errors = [];
    
    if (type && !['income', 'expense'].includes(type)) {
      errors.push('Type must be either income or expense');
    }
    
    if (amount && (isNaN(amount) || parseFloat(amount) <= 0)) {
      errors.push('Amount must be a positive number');
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    // Update fields
    if (type) transaction.type = type;
    if (amount) transaction.amount = parseFloat(amount);
    if (category) transaction.category = category.trim();
    if (description !== undefined) transaction.description = description.trim();
    if (date) transaction.date = new Date(date);
    
    const updatedTransaction = await transaction.save();
    
    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: updatedTransaction
    });
    
  } catch (error) {
    console.error('Update transaction error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction ID'
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating transaction'
    });
  }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private
const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    await Transaction.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Transaction deleted successfully',
      data: { id: req.params.id }
    });
    
  } catch (error) {
    console.error('Delete transaction error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while deleting transaction'
    });
  }
};

// @desc    Get transaction statistics
// @route   GET /api/transactions/stats
// @access  Private
const getTransactionStats = async (req, res) => {
  try {
    const { period = 'month', year, month } = req.query;
    
    let dateFilter = { userId: req.user._id };
    const now = new Date();
    
    // Build date filter based on period
    switch (period) {
      case 'week':
        dateFilter.date = {
          $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
          $lte: now
        };
        break;
      case 'month':
        const targetYear = year ? parseInt(year) : now.getFullYear();
        const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
        dateFilter.date = {
          $gte: new Date(targetYear, targetMonth, 1),
          $lt: new Date(targetYear, targetMonth + 1, 1)
        };
        break;
      case 'year':
        const targetYearForYear = year ? parseInt(year) : now.getFullYear();
        dateFilter.date = {
          $gte: new Date(targetYearForYear, 0, 1),
          $lt: new Date(targetYearForYear + 1, 0, 1)
        };
        break;
      case 'all':
        // No additional date filter
        break;
    }
    
    // Get category-wise breakdown
    const categoryStats = await Transaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { category: '$category', type: '$type' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);
    
    // Get monthly trend (last 12 months)
    const monthlyTrend = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: { $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);
    
    // Get daily trend for current month
    const dailyTrend = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1),
            $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
          }
        }
      },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: '$date' },
            type: '$type'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.day': 1 }
      }
    ]);
    
    // Get top spending categories
    const topCategories = await Transaction.aggregate([
      {
        $match: { ...dateFilter, type: 'expense' }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { total: -1 }
      },
      {
        $limit: 5
      }
    ]);
    
    res.json({
      success: true,
      data: {
        categoryStats,
        monthlyTrend,
        dailyTrend,
        topCategories,
        period,
        dateRange: dateFilter.date || 'all'
      }
    });
    
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics'
    });
  }
};

// @desc    Get transactions by category
// @route   GET /api/transactions/category/:category
// @access  Private
const getTransactionsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const filter = {
      userId: req.user._id,
      category: { $regex: category, $options: 'i' }
    };
    
    const skip = (page - 1) * parseInt(limit);
    
    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await Transaction.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        },
        category
      }
    });
    
  } catch (error) {
    console.error('Get transactions by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching transactions by category'
    });
  }
};

export {
  getTransactions,
  getTransaction,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionStats,
  getTransactionsByCategory
};