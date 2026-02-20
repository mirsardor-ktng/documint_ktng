
/**
 * Converts a Russian name (Фамилия И. О.) to the genitive case.
 * This is a simplified implementation focusing on common endings.
 * @param name The name in nominative case (e.g., "Иванов И. И." or "Байсеитова У.")
 * @returns The name potentially converted to genitive case (e.g., "Иванова И. И." or "Байсеитовой У.")
 */
export function getGenitiveCase(name: string | undefined): string {
    if (!name || typeof name !== 'string') return '';

    const parts = name.trim().split(' ');
    if (parts.length === 0) return '';

    let lastName = parts[0];
    const initials = parts.slice(1).join(' '); // Keep initials as they are

    // Rules priority: Specific endings first, then more general ones.

    // Feminine endings -ова/-ева/-ина/-ая -> -овой/-евой/-иной/-ой
     if (lastName.endsWith('ова') || lastName.endsWith('ева') || lastName.endsWith('ина')) {
         lastName = lastName.substring(0, lastName.length - 1) + 'ой';
     } else if (lastName.endsWith('ая')) {
         lastName = lastName.substring(0, lastName.length - 2) + 'ой';
     }
    // More general feminine -а -> -ой (e.g., Петрова -> Петровой, Байматова -> Байматовой)
    // Ensure not changing masculine -ска/-цка or specific names like 'Гурцкая'
    else if (lastName.endsWith('а') && !lastName.endsWith('ска') && !lastName.endsWith('цка') && lastName !== 'Гурцкая' && !lastName.endsWith('ока')) { // Added exceptions
        lastName = lastName.substring(0, lastName.length - 1) + 'ой';
    }
    // Feminine ending -я -> -и (e.g., Синяя -> Синей - already covered by -ая? No, consider Берия -> Берии)
    // Also applies to nouns like Мария -> Марии, but surnames are less common. Let's try -и.
    // Add exception for 'я' ending like 'Галустян' (masculine) - check consonant before 'я'? Tricky.
    // Let's refine: if ends in 'я' and previous is vowel (mostly feminine like 'Дарья'), change to 'и'.
    else if (lastName.endsWith('я')) {
        if (/[аеиоуыэюя]я$/i.test(lastName)) { // Vowel before 'я' -> feminine ending '-и'
             lastName = lastName.substring(0, lastName.length - 1) + 'и';
        } else if (/[бвгджзклмнпрстфхцчшщ]я$/i.test(lastName)) { // Consonant before 'я' -> masculine ending '-и' (e.g. Илья -> Ильи) ? Often '-я' -> '-и' for masculine too
             lastName = lastName.substring(0, lastName.length - 1) + 'и'; // Tentatively use '-и' for consonant + 'я' too
        }
        // If just 'я' like 'Я', no change? Or handle common names. Keep simple for now.
    }
    // Masculine endings -ов/-ев/-ин -> -ова/-ева/-ина (e.g. Иванов -> Иванова)
    else if (lastName.endsWith('ов') || lastName.endsWith('ев')) {
        lastName += 'а';
    } else if (lastName.endsWith('ин') && !lastName.endsWith('шин') && !lastName.endsWith('чин')) { // Avoid -шин/-чин common in masculine
        lastName += 'а';
    }
    // Masculine endings -ский/-цкий -> -ского/-цкого (e.g. Невский -> Невского)
    else if (lastName.endsWith('ский') || lastName.endsWith('цкий')) {
      lastName = lastName.substring(0, lastName.length - 2) + 'ого';
    }
    // Masculine ending -ой -> -ого (e.g., Толстой -> Толстого)
    else if (lastName.endsWith('ой')) {
        lastName = lastName.substring(0, lastName.length - 2) + 'ого';
    }
    // Masculine ending -ый/-ий -> -ого/-его (e.g. Белый -> Белого)
    else if (lastName.endsWith('ый') || lastName.endsWith('ий')) {
        lastName = lastName.substring(0, lastName.length - 2) + 'ого';
    }
    // Masculine surnames ending in soft sign 'ь' -> 'я' (e.g. Воробей -> Воробья)
    else if (lastName.endsWith('ь')) {
        lastName = lastName.substring(0, lastName.length - 1) + 'я';
    }
    // Masculine ending in consonant -> add 'а' (e.g. Мельник -> Мельника)
    // Exclude 'й' which is handled by -ый/-ий or -ой
    // Add exceptions for some consonant endings that don't change or change differently (e.g., foreign names) - complex!
    else if (/[бвгджзклмнпрстфхцчшщ]$/i.test(lastName)) {
         // Check for common non-inflecting consonant endings if needed (e.g., 'Кох')
         // For simplicity, assume most standard Russian consonant endings take 'а'
         lastName += 'а';
    }

    // Reassemble the name
    return initials ? `${lastName} ${initials}` : lastName;
}


// Helper to format number with spaces
export const formatCurrencyUzbekSum = (value: string | number | undefined): string => {
    if (value === undefined || value === null || value === '') return '';

    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value;

    if (isNaN(num)) {
        return ''; // Return empty if not a valid number after cleaning
    }

    // Format with spaces as thousands separators, specific to Uzbek locale preference if possible
    // Using 'ru-RU' as a common locale that uses spaces. Adjust if a specific UZ locale is better.
    const formattedNumber = num.toLocaleString('ru-RU', {
        style: 'decimal', // Use 'decimal' to avoid automatic currency symbols
        maximumFractionDigits: 2, // Allow decimals if needed, though example is integer
        minimumFractionDigits: 0,
    });

    return formattedNumber;
};

// Helper to get raw numeric value from formatted string or number
export const getRawNumericValue = (value: string | number | undefined): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const cleanedString = typeof value === 'string' ? value.replace(/[^0-9.]/g, '') : String(value);
    const num = parseFloat(cleanedString);
    return isNaN(num) ? null : num;
};

// Helper to sanitize filename parts
export const sanitizeFilename = (name: string) => name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
