// ─────────────────────────────────────────────────────────────────────────────
// AI-EcoTrack — Core TypeScript Interfaces
// Mirrors the production JSON schemas from the technical specification.
// ─────────────────────────────────────────────────────────────────────────────

// ── VLM Output ────────────────────────────────────────────────────────────────

export interface VisualId {
    part_class: string;
    subtype: string;
    confidence_score: number;
    bounding_box?: [number, number, number, number];
}

export interface MaterialInference {
    primary_material: string;
    secondary_material?: string;
    confidence_score: number;
    surface_condition?: string;
    estimated_alloy_grade?: string;
}

export interface HazardFlags {
    asbestos_era_likelihood: boolean;
    lead_solder_likelihood: boolean;
    pressurized_component: boolean;
    residual_fluid_risk: string; // "none" | "hydrocarbon_likely" | "chemical_likely" | etc.
}

export interface GeometryDescriptor {
    nominal_size_mm?: number;
    connection_type?: string;
    estimated_mass_kg?: number;
}

export interface PartMetadataPayload {
    visual_id: VisualId;
    material_inference: MaterialInference;
    hazard_flags: HazardFlags;
    geometry_descriptor: GeometryDescriptor;
    query_intent:
    | 'disassembly_sequence_retrieval'
    | 'material_data_retrieval'
    | 'safety_protocol_retrieval';
    fallback_required: boolean;
    escalation_required?: boolean;
    safety_doc_filters?: string[];        // injected by gatekeeper
    injected_regulations?: string[];      // labels for injected safety docs
}

// ── RAG Layer ─────────────────────────────────────────────────────────────────

export interface RagQueryPayload {
    semantic_query: string;
    namespace_filter: string[];
    metadata_filters: {
        part_class: string;
        material_family: string;
        regulatory_region?: string;
        pressure_rated?: boolean;
    };
    top_k: number;
    rerank: boolean;
    safety_docs_mandatory: boolean;
}

export interface DisassemblyStep {
    step: number;
    action: string;
    tool_required: string | null;
    safety_ref: string | null;
    estimated_time_min: number;
}

export interface SourceCitation {
    title: string;
    namespace: string;
    relevance_score: number;
    standard_id?: string;
}

export interface GuideResult {
    disassembly_steps: DisassemblyStep[];
    safety_protocols: string[];           // e.g. ["OSHA_1910.147", "ATEX_Directive"]
    source_citations: SourceCitation[];
    estimated_total_time_min: number;
    special_tooling_required?: string[];
    environmental_notes?: string[];
}

// ── Digital Product Passport ───────────────────────────────────────────────────

export interface PassportMetadata {
    passport_id: string;
    issued_at: string;
    issuing_entity: string;
    last_updated_at: string;
    lifecycle_stage:
    | 'in_service'
    | 'under_maintenance'
    | 'end_of_service'
    | 'life_expired'
    | 'scrapped';
    regulatory_frameworks: string[];
}

export interface Manufacturer {
    name: string;
    duns_number?: string;
    country_of_origin?: string;
}

export interface ComponentIdentity {
    ecotrack_uid: string;
    manufacturer_part_number?: string;
    manufacturer?: Manufacturer;
    description: string;
    serial_number?: string;
    manufacture_date?: string;
    installation_date?: string;
}

export type RecyclabilityClass = 'A' | 'B' | 'C' | 'UNKNOWN';

export interface BillOfMaterialsEntry {
    component_name: string;
    material_designation: string;
    material_standard?: string;
    alloy_grade?: string | null;
    mass_kg: number;
    mass_fraction_pct: number;
    recyclability_class: RecyclabilityClass;
    recovery_value_usd_per_kg: number;
    hazardous_substance_content: boolean;
}

export interface MaterialComposition {
    bill_of_materials: BillOfMaterialsEntry[];
    total_mass_kg: number;
    weighted_recyclability_index: number;
    total_theoretical_recovery_value_usd: number;
}

export interface MaintenanceEvent {
    event_id: string;
    date: string;
    type: string;
    technician_id?: string;
    parts_replaced?: string[];
    condition_notes?: string;
}

export interface ServiceHistory {
    operating_hours?: number;
    service_fluid?: string;
    max_operating_pressure_bar?: number;
    max_operating_temp_c?: number;
    maintenance_events: MaintenanceEvent[];
    failure_codes_recorded: string[];
    remaining_useful_life_estimate_hrs?: number;
}

export interface VlmIdentificationEvent {
    scan_timestamp: string;
    device_id: string;
    technician_id: string;
    vlm_model_version: string;
    part_confidence_score: number;
    material_confidence_score: number;
    hazard_flags_triggered: string[];
    safety_protocols_served: string[];
}

export interface DisassemblyPassport {
    vlm_identification_event: VlmIdentificationEvent;
    recommended_disassembly_sequence: DisassemblyStep[];
}

export interface MaterialStream {
    material: string;
    mass_kg: number;
    purity_grade: RecyclabilityClass;
    destination_bin_id: string;
    estimated_spot_value_usd: number;
}

export interface EndOfLifeRouting {
    assessment_date: string;
    assessed_by_technician: string;
    routing_decision: 'refurbishment' | 'material_recovery' | 'scrap_mandatory' | 'pending';
    routing_rationale: string;
    material_streams: MaterialStream[];
    total_actual_recovery_value_usd: number;
    recovery_efficiency_pct: number;
}

export interface AuditTrailEvent {
    event: string;
    timestamp: string;
    actor: string;
}

// ── Regulatory Compliance Profile ────────────────────────────────────────────

export interface ComplianceFrameworkEntry {
    status: string;               // e.g. "COMPLIANT", "CONDITIONAL", "RESTRICTED"
    notes: string;
    action_required?: string;
}

export interface ComplianceProfile {
    material_id: string;
    display_name: string;
    RoHS3: ComplianceFrameworkEntry;
    REACH: ComplianceFrameworkEntry & { svhc_count: number };
    WEEE: { applicable: boolean; india_e_waste_rule?: string; notes?: string };
    EU_ESPR: { recyclability_class: string; end_of_life_route: string; recycled_content_pct?: number };
    BIS_India: { relevant_standards: string[]; e_waste_applicable: boolean; export_control?: string };
    is_hazardous: boolean;
    hazard_note?: string;
    special_disposal_required: boolean;
}

export interface DigitalProductPassport {
    $schema: string;
    $id: string;
    schema_version: string;
    passport_metadata: PassportMetadata;
    component_identity: ComponentIdentity;
    material_composition: MaterialComposition;
    service_history: ServiceHistory;
    disassembly_passport: DisassemblyPassport;
    end_of_life_routing: EndOfLifeRouting;
    audit_trail: AuditTrailEvent[];
    regulatory_compliance?: ComplianceProfile;   // populated from regulatory_compliance.json
}

// ── Incentive Ledger ───────────────────────────────────────────────────────────

export type PurityGrade = 'A' | 'B' | 'C' | 'REJECT';

export interface IncentiveLedgerEntry {
    entry_id: string;
    technician_id: string;
    shift_date: string;
    bin_id: string;
    material: string;
    mass_kg: number;
    commodity_price_usd_per_kg: number;
    purity_grade: PurityGrade;
    purity_multiplier: number;
    payout_usd: number;
    shift_bonus_coeff: number;
    reject_event: boolean;
}

// ── API Response wrappers ──────────────────────────────────────────────────────

export interface IdentifyPartResponse {
    success: boolean;
    payload?: PartMetadataPayload;
    error?: string;
    mock?: boolean;
}

export interface RetrieveGuideResponse {
    success: boolean;
    guide?: GuideResult;
    error?: string;
}

export interface GenerateDppResponse {
    success: boolean;
    dpp?: DigitalProductPassport;
    passport_id?: string;
    error?: string;
    mock?: boolean;
}

export interface ChatAssistantRequest {
    question: string;
    payload?: PartMetadataPayload | null;
    guide?: GuideResult | null;
    surface?: 'scan_result' | 'guide';
}

export interface ChatAssistantResponse {
    success: boolean;
    answer?: string;
    citations?: SourceCitation[];
    suggested_questions?: string[];
    error?: string;
}
