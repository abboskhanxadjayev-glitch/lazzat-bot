function PageHeader({ eyebrow, title, description }) {
  return (
    <section className="mb-5">
      <p className="section-label">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-bold text-lazzat-maroon">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-lazzat-ink/75">{description}</p>
    </section>
  );
}

export default PageHeader;
