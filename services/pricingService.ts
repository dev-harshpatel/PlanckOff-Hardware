import {
    Door,
    HardwareSet,
    HardwareItem,
    DoorPricing,
    FramePricing,
    HardwareSetPricing,
    ProjectPricing,
    PriceBookEntry,
    PricingSettings,
    DiscountTier,
    DoorLineItem,
    HardwareLineItem,
    PricingReport
} from '../types';

/**
 * Pricing Service
 * 
 * Comprehensive pricing calculations for doors, frames, and hardware sets.
 * Supports price book lookups, markup/margin calculations, quantity discounts,
 * and project-level pricing summaries.
 */

// ===== DEFAULT PRICING SETTINGS =====

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
    defaultLaborRate: 75, // $/hour
    defaultMaterialMarkup: 35, // 35%
    defaultLaborMarkup: 25, // 25%
    defaultOverheadPercentage: 15, // 15%
    defaultProfitMargin: 20, // 20%
    defaultTaxRate: 8, // 8%
    includeShipping: true,
    defaultShippingCost: 500,
    quantityDiscounts: [
        { minQuantity: 10, maxQuantity: 24, discountPercentage: 5 },
        { minQuantity: 25, maxQuantity: 49, discountPercentage: 10 },
        { minQuantity: 50, discountPercentage: 15 }
    ]
};

// ===== PRICE LOOKUP FUNCTIONS =====

/**
 * Look up price for a door from price book
 */
export function lookupDoorPrice(
    door: Door,
    priceBook: PriceBookEntry[]
): number {
    // Find matching price book entry
    const entry = priceBook.find(e => 
        e.category === 'door' &&
        (!e.specifications?.material || e.specifications.material === door.doorMaterial) &&
        (!e.specifications?.width || e.specifications.width === door.width) &&
        (!e.specifications?.height || e.specifications.height === door.height) &&
        (!e.specifications?.thickness || e.specifications.thickness === door.thickness) &&
        (!e.specifications?.finish || e.specifications.finish === door.doorFinish) &&
        (!e.specifications?.fireRating || e.specifications.fireRating === door.fireRating)
    );

    if (entry) {
        return entry.unitPrice;
    }

    // Default pricing if not found
    return getDefaultDoorPrice(door);
}

/**
 * Look up price for a frame from price book
 */
export function lookupFramePrice(
    frameType: string | undefined,
    priceBook: PriceBookEntry[]
): number {
    if (!frameType) return 0;

    const entry = priceBook.find(e => 
        e.category === 'frame' &&
        e.itemType === frameType
    );

    return entry ? entry.unitPrice : 150; // Default frame price
}

/**
 * Look up price for hardware item from price book
 */
export function lookupHardwarePrice(
    item: HardwareItem,
    priceBook: PriceBookEntry[]
): number {
    if (item.unitPrice) return item.unitPrice;

    const entry = priceBook.find(e => 
        e.category === 'hardware' &&
        e.manufacturer === item.manufacturer &&
        e.modelNumber === item.modelNumber
    );

    if (entry) {
        return entry.unitPrice;
    }

    // Fallback: search by name
    const nameEntry = priceBook.find(e => 
        e.category === 'hardware' &&
        e.itemType.toLowerCase().includes(item.name.toLowerCase())
    );

    return nameEntry ? nameEntry.unitPrice : 0;
}

/**
 * Get default door price based on specifications
 */
function getDefaultDoorPrice(door: Door): number {
    let basePrice = 300; // Base price

    // Material adjustments
    if (door.doorMaterial?.includes('Wood')) basePrice += 200;
    if (door.doorMaterial?.includes('Metal')) basePrice += 100;
    if (door.doorMaterial?.includes('Fiberglass')) basePrice += 150;

    // Size adjustments
    const area = (door.width * door.height) / 144; // sq ft
    if (area > 25) basePrice += 100;
    if (area > 35) basePrice += 150;

    // Fire rating adjustments
    if (door.fireRating) {
        const rating = parseInt(door.fireRating);
        if (rating >= 90) basePrice += 200;
        else if (rating >= 60) basePrice += 150;
        else if (rating >= 20) basePrice += 100;
    }

    return basePrice;
}

// ===== DOOR PRICING CALCULATIONS =====

/**
 * Calculate comprehensive door pricing
 */
export function calculateDoorPricing(
    door: Door,
    priceBook: PriceBookEntry[] = []
): DoorPricing {
    // 1. Base door price
    const baseDoorPrice = lookupDoorPrice(door, priceBook);

    // 2. Frame price
    const framePrice = lookupFramePrice(door.frameMaterial, priceBook);

    // 3. Preparation/machining cost
    const prepPrice = calculatePrepCost(door);

    // 4. Finish upcharge
    const finishPrice = calculateFinishUpcharge(door.doorFinish);

    // 5. Fire rating upcharge
    const fireRatingUpcharge = calculateFireRatingUpcharge(door.fireRating);

    // 6. Total
    const totalDoorPrice = baseDoorPrice + framePrice + prepPrice + finishPrice + fireRatingUpcharge;

    return {
        baseDoorPrice,
        framePrice,
        prepPrice,
        finishPrice,
        fireRatingUpcharge,
        totalDoorPrice
    };
}

/**
 * Calculate preparation/machining cost
 */
function calculatePrepCost(door: Door): number {
    let prepCost = 0;

    // Base prep for hardware
    if (door.assignedHardwareSet) {
        const itemCount = door.assignedHardwareSet.items.length;
        prepCost += itemCount * 15; // $15 per hardware item prep
    }

    // Additional prep for special features
    if (door.fireRating) prepCost += 50;
    if (door.doorFaceType === 'Glass') prepCost += 75;

    return prepCost;
}

/**
 * Calculate finish upcharge
 */
function calculateFinishUpcharge(finish: string | undefined): number {
    if (!finish) return 0;

    const finishLower = finish.toLowerCase();
    
    if (finishLower.includes('stain')) return 75;
    if (finishLower.includes('paint')) return 50;
    if (finishLower.includes('powder coat')) return 100;
    if (finishLower.includes('anodized')) return 125;
    if (finishLower.includes('bronze')) return 150;

    return 0;
}

/**
 * Calculate fire rating upcharge
 */
function calculateFireRatingUpcharge(fireRating: string | undefined): number {
    if (!fireRating) return 0;

    const rating = parseInt(fireRating);
    
    if (rating >= 180) return 300;
    if (rating >= 90) return 200;
    if (rating >= 60) return 150;
    if (rating >= 20) return 100;

    return 0;
}

// ===== FRAME PRICING CALCULATIONS =====

/**
 * Calculate frame pricing
 */
export function calculateFramePricing(
    door: Door,
    priceBook: PriceBookEntry[] = []
): FramePricing {
    // 1. Base frame price
    const baseFramePrice = lookupFramePrice(door.frameMaterial, priceBook);

    // 2. Anchor price
    const anchorPrice = calculateAnchorPrice(door.anchorType, door.anchorSpacing);

    // 3. Silencer price
    const silencerPrice = (door.silencerQuantity || 0) * 5; // $5 per silencer

    // 4. Prep price
    const prepPrice = door.framePreparationNotes ? 25 : 0;

    // 5. Finish price
    const finishPrice = calculateFinishUpcharge(door.doorFinish);

    // 6. Total
    const totalFramePrice = baseFramePrice + anchorPrice + silencerPrice + prepPrice + finishPrice;

    return {
        baseFramePrice,
        anchorPrice,
        silencerPrice,
        prepPrice,
        finishPrice,
        totalFramePrice
    };
}

/**
 * Calculate anchor pricing
 */
function calculateAnchorPrice(anchorType: string | undefined, spacing: string | undefined): number {
    if (!anchorType) return 0;

    let basePrice = 20; // Base anchor cost

    if (anchorType.includes('Welded')) basePrice = 40;
    if (anchorType.includes('Expansion')) basePrice = 30;

    // Adjust for spacing (more anchors = higher cost)
    if (spacing && parseInt(spacing) < 16) basePrice *= 1.5;

    return basePrice;
}

// ===== HARDWARE SET PRICING CALCULATIONS =====

/**
 * Calculate hardware set pricing
 */
export function calculateHardwareSetPricing(
    hardwareSet: HardwareSet,
    doorsUsingSet: number,
    priceBook: PriceBookEntry[] = [],
    settings: PricingSettings = DEFAULT_PRICING_SETTINGS
): HardwareSetPricing {
    // 1. Material cost (sum of all items)
    const materialCost = hardwareSet.items.reduce((sum, item) => {
        const unitPrice = item.unitPrice || lookupHardwarePrice(item, priceBook);
        return sum + (unitPrice * item.quantity);
    }, 0);

    // 2. Labor cost
    const laborCost = hardwareSet.items.reduce((sum, item) => {
        const installTime = item.installationTime || getDefaultInstallTime(item.name);
        return sum + ((installTime / 60) * settings.defaultLaborRate * item.quantity);
    }, 0);

    // 3. Total cost per set
    const totalCost = materialCost + laborCost;

    // 4. Apply markup
    const markup = settings.defaultMaterialMarkup;
    const sellPrice = totalCost * (1 + markup / 100);

    // 5. Calculate margin
    const margin = ((sellPrice - totalCost) / sellPrice) * 100;

    return {
        materialCost,
        laborCost,
        totalCost,
        markup,
        margin,
        sellPrice
    };
}

/**
 * Get default installation time for hardware item
 */
function getDefaultInstallTime(itemName: string): number {
    const nameLower = itemName.toLowerCase();

    if (nameLower.includes('lock') || nameLower.includes('latch')) return 45;
    if (nameLower.includes('closer')) return 30;
    if (nameLower.includes('hinge')) return 15;
    if (nameLower.includes('exit device')) return 60;
    if (nameLower.includes('threshold')) return 20;
    if (nameLower.includes('weatherstrip')) return 15;

    return 10; // Default
}

// ===== PROJECT PRICING CALCULATIONS =====

/**
 * Calculate comprehensive project pricing
 */
export function calculateProjectPricing(
    doors: Door[],
    hardwareSets: HardwareSet[],
    priceBook: PriceBookEntry[] = [],
    settings: PricingSettings = DEFAULT_PRICING_SETTINGS
): ProjectPricing {
    // Calculate door costs
    let totalDoorsCost = 0;
    let totalFramesCost = 0;

    doors.forEach(door => {
        const doorPricing = calculateDoorPricing(door, priceBook);
        const framePricing = calculateFramePricing(door, priceBook);
        
        totalDoorsCost += doorPricing.totalDoorPrice;
        totalFramesCost += framePricing.totalFramePrice;
    });

    // Calculate hardware costs
    let totalHardwareCost = 0;

    hardwareSets.forEach(set => {
        const doorsUsingSet = doors.filter(d => 
            d.assignedHardwareSet?.id === set.id
        ).length;

        if (doorsUsingSet > 0) {
            const setPricing = calculateHardwareSetPricing(set, doorsUsingSet, priceBook, settings);
            totalHardwareCost += setPricing.sellPrice * doorsUsingSet;
        }
    });

    // Subtotal
    const subtotal = totalDoorsCost + totalFramesCost + totalHardwareCost;

    // Tax
    const taxRate = settings.defaultTaxRate;
    const taxAmount = subtotal * (taxRate / 100);

    // Shipping
    const shippingCost = settings.includeShipping ? settings.defaultShippingCost : 0;

    // Total cost
    const totalCost = subtotal + taxAmount + shippingCost;

    // Overhead
    const overheadAmount = totalCost * (settings.defaultOverheadPercentage / 100);

    // Profit
    const profitMargin = settings.defaultProfitMargin;
    const totalSellPrice = (totalCost + overheadAmount) * (1 + profitMargin / 100);
    const totalProfit = totalSellPrice - totalCost;
    const profitMarginPercentage = (totalProfit / totalSellPrice) * 100;

    return {
        totalDoorsCost,
        totalFramesCost,
        totalHardwareCost,
        subtotal,
        taxRate,
        taxAmount,
        shippingCost,
        discountAmount: 0,
        materialMarkup: settings.defaultMaterialMarkup,
        laborMarkup: settings.defaultLaborMarkup,
        overheadPercentage: settings.defaultOverheadPercentage,
        profitMargin,
        totalCost,
        totalSellPrice,
        totalProfit,
        profitMarginPercentage
    };
}

// ===== MARKUP & MARGIN UTILITIES =====

/**
 * Apply markup to cost
 */
export function applyMarkup(cost: number, markupPercent: number): number {
    return cost * (1 + markupPercent / 100);
}

/**
 * Calculate margin from cost and sell price
 */
export function calculateMargin(cost: number, sellPrice: number): number {
    if (sellPrice === 0) return 0;
    return ((sellPrice - cost) / sellPrice) * 100;
}

/**
 * Calculate sell price from cost and desired margin
 */
export function calculateSellPriceFromMargin(cost: number, marginPercent: number): number {
    return cost / (1 - marginPercent / 100);
}

// ===== QUANTITY DISCOUNT UTILITIES =====

/**
 * Apply quantity discount to unit price
 */
export function applyQuantityDiscount(
    unitPrice: number,
    quantity: number,
    discountTiers: DiscountTier[]
): number {
    const tier = discountTiers.find(t => 
        quantity >= t.minQuantity && 
        (!t.maxQuantity || quantity <= t.maxQuantity)
    );

    if (tier) {
        return unitPrice * (1 - tier.discountPercentage / 100);
    }

    return unitPrice;
}

// ===== REPORT GENERATION =====

/**
 * Generate pricing report
 */
export function generatePricingReport(
    doors: Door[],
    hardwareSets: HardwareSet[],
    priceBook: PriceBookEntry[] = [],
    settings: PricingSettings = DEFAULT_PRICING_SETTINGS,
    metadata: {
        projectName: string;
        generatedBy: string;
        validUntil?: Date;
        notes?: string;
        terms?: string;
    }
): PricingReport {
    // Generate door line items
    const doorLineItems: DoorLineItem[] = doors.map(door => {
        const pricing = calculateDoorPricing(door, priceBook);
        return {
            doorTag: door.doorTag,
            description: `${door.doorMaterial} Door ${door.width}x${door.height}x${door.thickness}`,
            quantity: 1,
            unitPrice: pricing.totalDoorPrice,
            extendedPrice: pricing.totalDoorPrice,
            pricing
        };
    });

    // Generate hardware line items
    const hardwareLineItems: HardwareLineItem[] = hardwareSets.map(set => {
        const doorsUsingSet = doors.filter(d => 
            d.assignedHardwareSet?.id === set.id
        ).length;

        const pricing = calculateHardwareSetPricing(set, doorsUsingSet, priceBook, settings);

        return {
            hardwareSetName: set.name,
            description: set.description,
            doorsUsingSet,
            unitPrice: pricing.sellPrice,
            extendedPrice: pricing.sellPrice * doorsUsingSet,
            pricing
        };
    });

    // Calculate project pricing
    const pricing = calculateProjectPricing(doors, hardwareSets, priceBook, settings);

    return {
        projectName: metadata.projectName,
        generatedDate: new Date(),
        generatedBy: metadata.generatedBy,
        doorLineItems,
        hardwareLineItems,
        pricing,
        validUntil: metadata.validUntil,
        notes: metadata.notes,
        terms: metadata.terms
    };
}

// ===== EXPORT =====

export default {
    lookupDoorPrice,
    lookupFramePrice,
    lookupHardwarePrice,
    calculateDoorPricing,
    calculateFramePricing,
    calculateHardwareSetPricing,
    calculateProjectPricing,
    applyMarkup,
    calculateMargin,
    calculateSellPriceFromMargin,
    applyQuantityDiscount,
    generatePricingReport,
    DEFAULT_PRICING_SETTINGS
};
