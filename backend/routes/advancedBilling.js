const express = require('express');

const router = express.Router();

const sumValues = (obj) =>
  Object.values(obj || {}).reduce((sum, value) => sum + Number(value || 0), 0);

router.post('/billing/generate-report', (req, res) => {
  const { sharedCosts, occupancyMap, waterMeter, directCosts, paidAdvances = 0 } =
    req.body || {};

  if (!sharedCosts || !occupancyMap || !waterMeter || !directCosts) {
    return res.status(400).json({
      error:
        'Request musi obsahovat sharedCosts, occupancyMap, waterMeter a directCosts.',
    });
  }

  if (!Array.isArray(occupancyMap) || occupancyMap.length !== 12) {
    return res.status(400).json({
      error: 'occupancyMap musi byt pole 12 mesicu.',
    });
  }

  const invalidOccupancy = occupancyMap.find(
    (month) =>
      !month ||
      typeof month.housePeople !== 'number' ||
      typeof month.apartmentPeople !== 'number' ||
      month.housePeople < 0 ||
      month.apartmentPeople < 0 ||
      month.apartmentPeople > month.housePeople
  );

  if (invalidOccupancy) {
    return res.status(400).json({
      error:
        'Kazdy mesic v occupancyMap musi mit housePeople/apartmentPeople >= 0 a apartmentPeople <= housePeople.',
    });
  }

  const startState = Number(waterMeter.startState);
  const endState = Number(waterMeter.endState);
  const pricePerM3 = Number(waterMeter.pricePerM3);

  if (
    Number.isNaN(startState) ||
    Number.isNaN(endState) ||
    Number.isNaN(pricePerM3) ||
    endState < startState ||
    pricePerM3 < 0
  ) {
    return res.status(400).json({
      error:
        'waterMeter musi obsahovat validni startState, endState (>= startState) a pricePerM3.',
    });
  }

  const sharedCostsTotal = sumValues(sharedCosts);
  const directCostsTotal = sumValues(directCosts);

  const totalHousePersonMonths = occupancyMap.reduce(
    (sum, month) => sum + month.housePeople,
    0
  );
  const totalApartmentPersonMonths = occupancyMap.reduce(
    (sum, month) => sum + month.apartmentPeople,
    0
  );

  const monthlySharedBreakdown = occupancyMap.map((month, index) => {
    if (totalHousePersonMonths === 0) {
      return {
        month: index + 1,
        housePeople: month.housePeople,
        apartmentPeople: month.apartmentPeople,
        sharedCostAllocation: 0,
      };
    }

    const sharedCostAllocation =
      (sharedCostsTotal * month.apartmentPeople) / totalHousePersonMonths;

    return {
      month: index + 1,
      housePeople: month.housePeople,
      apartmentPeople: month.apartmentPeople,
      sharedCostAllocation: Number(sharedCostAllocation.toFixed(2)),
    };
  });

  const sharedCostsAllocatedTotal = Number(
    monthlySharedBreakdown
      .reduce((sum, month) => sum + month.sharedCostAllocation, 0)
      .toFixed(2)
  );

  const waterConsumptionM3 = Number((endState - startState).toFixed(3));
  const waterCost = Number((waterConsumptionM3 * pricePerM3).toFixed(2));

  const totalCosts = Number(
    (sharedCostsAllocatedTotal + waterCost + directCostsTotal).toFixed(2)
  );
  const balance = Number((Number(paidAdvances || 0) - totalCosts).toFixed(2));

  res.json({
    summary: {
      sharedCostsTotal: Number(sharedCostsTotal.toFixed(2)),
      sharedCostsAllocatedTotal,
      totalHousePersonMonths,
      totalApartmentPersonMonths,
      waterConsumptionM3,
      waterCost,
      directCostsTotal: Number(directCostsTotal.toFixed(2)),
      paidAdvances: Number(Number(paidAdvances || 0).toFixed(2)),
      totalCosts,
      balance,
      resultType: balance >= 0 ? 'preplatek' : 'nedoplatek',
    },
    monthlySharedBreakdown,
  });
});

module.exports = router;
