import React from 'react';
import PageHeader from './PageHeader';

/**
 * Every page component in /pages currently just renders this.
 * Swap the body of each page file with the real design when ready -
 * routing, sidebar, and auth guarding already works end-to-end.
 */
export default function PlaceholderPage({ title, description }) {
  return (
    <div>
      <PageHeader title={title} subtitle={description ?? 'This page is ready to be designed.'} />
      <div className="bg-white border border-dashed border-slate-300 rounded-xl h-[60vh] flex items-center justify-center text-slate-400 text-sm">
        {title} content goes here
      </div>
    </div>
  );
}
