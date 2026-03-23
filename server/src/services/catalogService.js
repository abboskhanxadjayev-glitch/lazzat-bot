import { supabase } from "../config/supabase.js";
import { categories as mockCategories, products as mockProducts } from "../data/mockData.js";

function countProductsByCategory(products) {
  return products.reduce((counts, product) => {
    counts.set(product.categoryId, (counts.get(product.categoryId) || 0) + 1);
    return counts;
  }, new Map());
}

function buildCategory(category, productCount = 0) {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    sortOrder: category.sortOrder ?? category.sort_order ?? 0,
    productCount
  };
}

function buildProduct(product, category) {
  return {
    id: product.id,
    categoryId: product.categoryId ?? product.category_id,
    categorySlug: category?.slug || "",
    categoryName: category?.name || "Mahsulot",
    name: product.name,
    description: product.description,
    price: Number(product.price),
    isPopular: product.isPopular ?? product.is_popular ?? false,
    sortOrder: product.sortOrder ?? product.sort_order ?? 0
  };
}

function getFallbackCategories() {
  const counts = countProductsByCategory(mockProducts);

  return [...mockCategories]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((category) => buildCategory(category, counts.get(category.id) || 0));
}

function getFallbackProducts(filters = {}) {
  const categoryMap = new Map(mockCategories.map((category) => [category.id, category]));

  return mockProducts
    .filter((product) => {
      if (filters.categoryId && product.categoryId !== filters.categoryId) {
        return false;
      }

      if (filters.categorySlug) {
        const category = categoryMap.get(product.categoryId);
        return category?.slug === filters.categorySlug;
      }

      return true;
    })
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((product) => buildProduct(product, categoryMap.get(product.categoryId)));
}

export async function getCategories() {
  if (!supabase) {
    return getFallbackCategories();
  }

  try {
    const { data: categoryRows, error: categoryError } = await supabase
      .from("categories")
      .select("id, slug, name, description, sort_order")
      .order("sort_order", { ascending: true });

    if (categoryError || !categoryRows?.length) {
      return getFallbackCategories();
    }

    const { data: productRows, error: productError } = await supabase
      .from("products")
      .select("category_id")
      .eq("is_available", true);

    if (productError) {
      return getFallbackCategories();
    }

    const counts = productRows.reduce((map, row) => {
      map.set(row.category_id, (map.get(row.category_id) || 0) + 1);
      return map;
    }, new Map());

    return categoryRows.map((category) => buildCategory(category, counts.get(category.id) || 0));
  } catch {
    return getFallbackCategories();
  }
}

export async function getProducts(filters = {}) {
  if (!supabase) {
    return getFallbackProducts(filters);
  }

  try {
    const categories = await getCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category]));

    let categoryId = filters.categoryId;

    if (!categoryId && filters.categorySlug) {
      const matchedCategory = categories.find(
        (category) => category.slug === filters.categorySlug
      );

      if (!matchedCategory) {
        return [];
      }

      categoryId = matchedCategory.id;
    }

    let query = supabase
      .from("products")
      .select("id, category_id, name, description, price, is_popular, sort_order")
      .eq("is_available", true)
      .order("sort_order", { ascending: true });

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;

    if (error || !data) {
      return getFallbackProducts(filters);
    }

    return data.map((product) => buildProduct(product, categoryMap.get(product.category_id)));
  } catch {
    return getFallbackProducts(filters);
  }
}

export async function getProductsByIds(productIds = []) {
  const requestedIds = [...new Set(productIds.filter(Boolean))];

  if (!requestedIds.length) {
    return [];
  }

  if (!supabase) {
    return getFallbackProducts().filter((product) => requestedIds.includes(product.id));
  }

  try {
    const categories = await getCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const { data, error } = await supabase
      .from("products")
      .select("id, category_id, name, description, price, is_popular, sort_order")
      .in("id", requestedIds)
      .eq("is_available", true);

    if (error || !data) {
      return getFallbackProducts().filter((product) => requestedIds.includes(product.id));
    }

    return data.map((product) => buildProduct(product, categoryMap.get(product.category_id)));
  } catch {
    return getFallbackProducts().filter((product) => requestedIds.includes(product.id));
  }
}
