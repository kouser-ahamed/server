import { Router } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/sendResponse';
import authMiddleware from '../middlewares/auth.middleware';
import roleMiddleware from '../middlewares/role.middleware';
import { VehicleService } from '../services/vehicle/vehicle.service';

const router = Router();

router.post(
  '/',
  authMiddleware,
  roleMiddleware('HOST', 'ADMIN'),
  catchAsync(async (req, res) => {
    const vehicle = await VehicleService.createVehicle(req.user!, req.body);
    sendResponse(res, {
      success: true,
      statusCode: 201,
      message: 'Vehicle created successfully',
      data: vehicle,
    });
  })
);

router.get(
  '/',
  catchAsync(async (req, res) => {
    const result = await VehicleService.getAllVehicles(req.query);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Vehicles retrieved successfully',
      data: result.vehicles,
      meta: result.meta,
    });
  })
);

router.get(
  '/host/vehicles',
  authMiddleware,
  roleMiddleware('HOST', 'ADMIN'),
  catchAsync(async (req, res) => {
    const result = await VehicleService.getHostVehicles(req.user!, req.query as { page?: number; limit?: number });
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Your vehicles retrieved successfully',
      data: result.vehicles,
      meta: result.meta,
    });
  })
);

router.get(
  '/:vehicleId',
  catchAsync(async (req, res) => {
    const vehicle = await VehicleService.getVehicleById(req.params.vehicleId);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Vehicle retrieved successfully',
      data: vehicle,
    });
  })
);

router.patch(
  '/:vehicleId',
  authMiddleware,
  catchAsync(async (req, res) => {
    const vehicle = await VehicleService.updateVehicle(req.params.vehicleId, req.user!, req.body);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Vehicle updated successfully',
      data: vehicle,
    });
  })
);

router.patch(
  '/:vehicleId/availability',
  authMiddleware,
  catchAsync(async (req, res) => {
    const vehicle = await VehicleService.toggleVehicleAvailability(req.params.vehicleId, req.user!);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Vehicle availability updated successfully',
      data: vehicle,
    });
  })
);

router.delete(
  '/:vehicleId',
  authMiddleware,
  catchAsync(async (req, res) => {
    await VehicleService.deleteVehicle(req.params.vehicleId, req.user!);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Vehicle deleted successfully',
      data: null,
    });
  })
);

export default router;
