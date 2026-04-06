const Call = require("../models/Call");

exports.getStats = async (req, res) => {
  try {
    const calls = await Call.find({ status: "completed" });

    const totalCalls = calls.length;

    const totalRevenue = calls.reduce((sum, call) => {
      return sum + (call.cost || 0);
    }, 0);

    const totalDurationSeconds = calls.reduce((sum, call) => {
      return sum + (call.durationSeconds || 0);
    }, 0);

    const totalMinutesRounded = calls.reduce((sum, call) => {
      return sum + (call.durationMinutesRounded || 0);
    }, 0);

    const averageDurationSeconds =
      totalCalls > 0 ? Math.round(totalDurationSeconds / totalCalls) : 0;

    res.json({
      totalCalls,
      totalRevenuePence: totalRevenue,
      totalRevenuePounds: (totalRevenue / 100).toFixed(2),
      totalDurationSeconds,
      totalMinutesRounded,
      averageDurationSeconds
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};