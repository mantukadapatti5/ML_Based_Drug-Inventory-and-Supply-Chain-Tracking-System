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

  const extractItems = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];

    for (const key of ["data", "items", "products", "alerts", "records", "batches", "users"]) {
      if (Array.isArray(payload[key])) return payload[key];
    }

    return [];
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try primary endpoint first
      const response = await primaryFetch();
      const items = extractItems(response.data);

      // A healthy but empty database is not useful to the panel. Try the
      // dataset fallback before showing an empty state to the user.
      if (items.length > 0) {
        setData(items);
        setSource("primary");
        console.log(`✅ Loaded ${items.length} records from primary endpoint`);
        return;
      }

      throw new Error("Primary endpoint returned no records");
    } catch (primaryError) {
      console.warn("⚠️  Primary endpoint failed, attempting fallback:", primaryError.message);

      try {
        // Fall back to CSV endpoint
        const fallbackResponse = await fallbackFetch();
        const items = extractItems(fallbackResponse.data);

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
