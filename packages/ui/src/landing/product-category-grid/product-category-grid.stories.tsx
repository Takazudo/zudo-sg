import type { StoryMeta, Story } from "../../stories/types";
import { ProductCategoryGrid, type ProductCategoryGridProps, type ProductCategory } from "./product-category-grid";

const meta: StoryMeta = {
  title: "ProductCategoryGrid",
  category: "Content",
  description:
    "Product-top card grid, one card per business category with a tagline and a short list of representative items.",
  usage: `import { ProductCategoryGrid } from "@zudo-sg/ui/src/landing/product-category-grid/product-category-grid";

<ProductCategoryGrid heading="Our products" categories={categories} />`,
  order: 17,
};

export default meta;

const CATEGORIES: ProductCategory[] = [
  { title: "Electronic devices", tagline: "Sensors and modules for advanced systems.", items: ["Optical sensors", "Image processing ICs", "ToF sensors"], href: "/products/electronic-devices" },
  { title: "Components", tagline: "Precision components sourced from a trusted network.", items: ["Connectors", "Passive components", "Custom assemblies"], href: "/products/components" },
  { title: "Equipment", tagline: "Industrial equipment and systems integration.", items: ["Power devices", "Conditioners", "Control systems"], href: "/products/equipment" },
  { title: "Chemical materials", tagline: "Specialty chemical materials for industry.", items: ["Coatings", "Adhesives", "Additives"], href: "/products/chemical" },
];

export const Default: Story<ProductCategoryGridProps> = {
  name: "Default",
  render: () => (
    <div style={{ maxWidth: "960px" }}>
      <ProductCategoryGrid heading="Our products" intro="Four categories spanning electronics and chemicals." categories={CATEGORIES} />
    </div>
  ),
};

export const Narrow: Story<ProductCategoryGridProps> = {
  name: "Narrow (card wrap)",
  render: () => (
    <div style={{ maxWidth: "380px" }}>
      <ProductCategoryGrid heading="Our products" categories={CATEGORIES} />
    </div>
  ),
};
