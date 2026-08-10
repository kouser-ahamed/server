import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import authorizeRoles from '../../middlewares/role.middleware';
import { VehicleController } from './vehicle.controller';

const router = Router();

router.get('/', VehicleController.getAllVehicles);
router.get('/my-vehicles', authMiddleware, authorizeRoles('VENDOR'), VehicleController.getMyVehicles);

router.post('/', authMiddleware, authorizeRoles('VENDOR'), VehicleController.createVehicle);
router.get('/:id', VehicleController.getVehicleById);
router.patch('/:id', authMiddleware, authorizeRoles('VENDOR', 'ADMIN'), VehicleController.updateVehicle);
router.delete('/:id', authMiddleware, authorizeRoles('VENDOR', 'ADMIN'), VehicleController.deleteVehicle);

export default router;
