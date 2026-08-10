import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { VehicleService } from './vehicle.service';

const createVehicle = catchAsync(async (req: Request, res: Response) => {
  const vehicle = await VehicleService.createVehicle(req.user!, req.body);

  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: 'Vehicle created successfully',
    data: vehicle,
  });
});

const getAllVehicles = catchAsync(async (req: Request, res: Response) => {
  const result = await VehicleService.getAllVehicles(req.query);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Vehicles retrieved successfully',
    data: result.vehicles,
    meta: result.meta,
  });
});

const getVehicleById = catchAsync(async (req: Request, res: Response) => {
  const vehicle = await VehicleService.getVehicleById(req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Vehicle retrieved successfully',
    data: vehicle,
  });
});

const getMyVehicles = catchAsync(async (req: Request, res: Response) => {
  const result = await VehicleService.getMyVehicles(req.user!, req.query);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Your vehicles retrieved successfully',
    data: result.vehicles,
    meta: result.meta,
  });
});

const updateVehicle = catchAsync(async (req: Request, res: Response) => {
  const vehicle = await VehicleService.updateVehicle(req.params.id, req.user!, req.body);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Vehicle updated successfully',
    data: vehicle,
  });
});

const deleteVehicle = catchAsync(async (req: Request, res: Response) => {
  const vehicle = await VehicleService.deleteVehicle(req.params.id, req.user!);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Vehicle deleted successfully',
    data: vehicle,
  });
});

export const VehicleController = {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  getMyVehicles,
  updateVehicle,
  deleteVehicle,
};
