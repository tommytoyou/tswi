import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCollection } from '@/lib/db';
import { AlertRuleSchema, AlertRule } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Default alert rules to seed if collection is empty
const DEFAULT_RULES: Omit<AlertRule, '_id'>[] = [
  {
    name: 'Geomagnetic Storm Watch',
    description: 'Alert when Kp index indicates geomagnetic storm conditions (G1+)',
    conditions: [{ metric: 'kp_index', operator: 'gte', value: 5 }],
    severity: 'high',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    name: 'Solar Flare Alert',
    description: 'Alert when X-ray flux reaches M-class flare levels or higher',
    conditions: [{ metric: 'xray_flux', operator: 'gte', value: 1e-5 }],
    severity: 'high',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    name: 'High Speed Stream',
    description: 'Alert when solar wind speed exceeds 600 km/s',
    conditions: [{ metric: 'solar_wind_speed', operator: 'gt', value: 600 }],
    severity: 'medium',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    name: 'Southward Bz',
    description: 'Alert when IMF Bz goes strongly southward (negative), enhancing geomagnetic coupling',
    conditions: [{ metric: 'bz_value', operator: 'lt', value: -10 }],
    severity: 'medium',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    name: 'Severe Geomagnetic Storm',
    description: 'Alert when Kp reaches severe storm levels (G4+)',
    conditions: [{ metric: 'kp_index', operator: 'gte', value: 8 }],
    severity: 'critical',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    name: 'Proton Event',
    description: 'Alert when proton flux exceeds S1 radiation storm threshold',
    conditions: [{ metric: 'proton_flux', operator: 'gte', value: 10 }],
    severity: 'high',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
];

/**
 * GET /api/alerts/rules
 * Fetch all alert rules
 */
export async function GET() {
  try {
    const collection = await getCollection('alert_rules');

    // Check if collection is empty and seed default rules
    const count = await collection.countDocuments();
    if (count === 0) {
      await collection.insertMany(DEFAULT_RULES as any[]);
      console.log('Seeded default alert rules');
    }

    const rules = await collection.find({}).sort({ created_at: -1 }).toArray();

    return NextResponse.json({
      success: true,
      data: rules,
      count: rules.length,
    });
  } catch (error: any) {
    console.error('Error fetching alert rules:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch alert rules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts/rules
 * Create a new alert rule
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const ruleData = AlertRuleSchema.omit({ _id: true }).parse({
      ...body,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const collection = await getCollection('alert_rules');
    const result = await collection.insertOne(ruleData as any);

    return NextResponse.json({
      success: true,
      data: { _id: result.insertedId.toString(), ...ruleData },
    });
  } catch (error: any) {
    console.error('Error creating alert rule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create alert rule' },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/alerts/rules
 * Update an existing alert rule (expects _id in body)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { _id, ...updates } = body;

    if (!_id) {
      return NextResponse.json(
        { success: false, error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const collection = await getCollection('alert_rules');
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(_id) },
      { $set: { ...updates, updated_at: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error updating alert rule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update alert rule' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/alerts/rules
 * Delete an alert rule (expects _id in query params)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const _id = searchParams.get('id');

    if (!_id) {
      return NextResponse.json(
        { success: false, error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const collection = await getCollection('alert_rules');
    const result = await collection.deleteOne({ _id: new ObjectId(_id) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting alert rule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete alert rule' },
      { status: 400 }
    );
  }
}
