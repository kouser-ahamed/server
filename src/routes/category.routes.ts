import { Router } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/sendResponse';
import authMiddleware from '../middlewares/auth.middleware';
import roleMiddleware from '../middlewares/role.middleware';
import { CategoryService } from '../services/category/category.service';

const router = Router();

router.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN'),
  catchAsync(async (req, res) => {
    const category = await CategoryService.createCategory(req.body);
    sendResponse(res, {
      success: true,
      statusCode: 201,
      message: 'Category created successfully',
      data: category,
    });
  })
);

router.get(
  '/',
  catchAsync(async (req, res) => {
    const result = await CategoryService.getAllCategories(req.query as { page?: number; limit?: number });
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Categories retrieved successfully',
      data: result.categories,
      meta: result.meta,
    });
  })
);

router.get(
  '/:categoryId',
  catchAsync(async (req, res) => {
    const category = await CategoryService.getCategoryById(req.params.categoryId);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Category retrieved successfully',
      data: category,
    });
  })
);

router.patch(
  '/:categoryId',
  authMiddleware,
  roleMiddleware('ADMIN'),
  catchAsync(async (req, res) => {
    const category = await CategoryService.updateCategory(req.params.categoryId, req.body);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Category updated successfully',
      data: category,
    });
  })
);

router.delete(
  '/:categoryId',
  authMiddleware,
  roleMiddleware('ADMIN'),
  catchAsync(async (req, res) => {
    await CategoryService.deleteCategory(req.params.categoryId);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Category deleted successfully',
      data: null,
    });
  })
);

export default router;
