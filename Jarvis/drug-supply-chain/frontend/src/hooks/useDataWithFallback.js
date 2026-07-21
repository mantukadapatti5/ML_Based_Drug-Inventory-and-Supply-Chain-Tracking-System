import { useState, useEffect } from "react";

/**
 * useDataWithFallback Hook
 * 
 * Intelligent fallback mechanism: tries primary API endpoint, falls back to CSV fallback endpoint on failure.
 * Prevents infinite loading screens by ensuring setLoading(false) is always called in finally block.
 * 
 * @param {Function} primaryFetch - Primary API function to call
 * @param {Function} fallbackFetch - Fallback API function (CSV-based)
 * @param {Array} dependencies - useEffect dependency array
 * @returns {Object} { data, loading, error, refresh }
 */
export const useDataWithFallback = (primaryFetch, fallbackFetch, dependencies = []) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState("primary");

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try primary endpoint first
      const response = await primaryFetch();
      const result = response.data;

      // Extract data payload - handle different API response formats
      let items = [];
      if (Array.isArray(result)) {
        items = result;
      } else if (result.data && Array.isArray(result.data)) {
        items = result.data;
      } else if (result.products && Array.isArray(result.products)) {
        items = result.products;
      } else if (result.items && Array.isArray(result.items)) {
        items = result.items;
      } else if (result.alerts && Array.isArray(result.alerts)) {
        items = result.alerts;
      } else if (result.records && Array.isArray(result.records)) {
        items = result.records;
      }

      setData(items);
      setSource("primary");
      console.log(`✅ Loaded ${items.length} records from primary endpoint`);
    } catch (primaryError) {
      console.warn("⚠️  Primary endpoint failed, attempting fallback:", primaryError.message);

      try {
        // Fall back to CSV endpoint
        const fallbackResponse = await fallbackFetch();
        const fallbackResult = fallbackResponse.data;

        let items = [];
        if (Array.isArray(fallbackResult)) {
          items = fallbackResult;
        } else if (fallbackResult.data && Array.isArray(fallbackResult.data)) {
          items = fallbackResult.data;
        } else if (fallbackResult.records && Array.isArray(fallbackResult.records)) {
          items = fallbackResult.records;
        }

        setData(items);
        setSource("csv_fallback");
        console.log(`✅ Loaded ${items.length} records from CSV fallback endpoint`);
      } catch (fallbackError) {
        console.error("❌ Both primary and fallback endpoints failed:", fallbackError.message);
        setError({
          message: "Failed to load data",
          primary: primaryError.message,
          fallback: fallbackError.message,
        });
        setData([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, dependencies);

  return {
    data,
    loading,
    error,
    source,
    refresh: fetchData,
  };
};

/**
 * Safe data accessor function
 * Prevents crashes from missing columns by using optional chaining
 * 
 * @param {Object} record - Data record
 * @param {String} path - Dot-notation path (e.g., "user.name")
 * @param {*} defaultValue - Fallback value if path doesn't exist
 * @returns {*} Value at path or defaultValue
 */
export const getNestedValue = (record, path, defaultValue = "N/A") => {
  if (!record) return defaultValue;
  
  try {
    const keys = path.split(".");
    let value = record;
    
    for (const key of keys) {
      if (value == null) return defaultValue;
      // Try exact key first, then case-insensitive match
      value = value[key] ?? Object.values(value).find(v => 
        typeof v === "object" && v[key.toLowerCase()] !== undefined
      )?.[key.toLowerCase()];
    }
    
    return value ?? defaultValue;
  } catch {
    return defaultValue;
  }
};

/**
 * Normalizes column names from CSV to consistent camelCase
 * Handles variations like: "drug_name", "drugName", "Drug Name", "drug name"
 */
export const normalizeRecord = (record) => {
  if (!record || typeof record !== "object") return record;

  const normalized = {};
  for (const [key, value] of Object.entries(record)) {
    // Convert to camelCase
    const camelKey = key
      .toLowerCase()
      .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : "");
    normalized[camelKey] = value;
  }
  return normalized;
};

/**
 * Batch normalizes records for consistent column handling
 */
export const normalizeRecords = (records) => {
  if (!Array.isArray(records)) return [];
  return records.map(normalizeRecord);
};
