
import React, { useState, useMemo } from 'react';
import { Report, HardwareSummary, HardwareSummaryItemDetails } from '../types';
import { exportReportToCSV } from '../utils/csvExporter';
import { DocumentChartBarIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, ChevronDownIcon, ChevronUpIcon } from './icons';

interface EstimationReportProps {
  report: Report | null;
  projectName: string;
}

type SortKey = keyof HardwareSummaryItemDetails | 'totalQuantity';
type SortDirection = 'asc' | 'desc';

const EstimationReport: React.FC<EstimationReportProps> = ({ report, projectName }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });

  const handleExport = () => {
    if (report) {
      exportReportToCSV(report, projectName);
    }
  };
  
  const handleSort = (key: SortKey) => {
      let direction: SortDirection = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const filteredAndSortedHardware = useMemo(() => {
      if (!report) return [];

      let data: HardwareSummary[] = Object.values(report.hardwareSummary);

      // Filter
      if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          data = data.filter(summary => 
              summary.item.name.toLowerCase().includes(query) ||
              summary.item.description.toLowerCase().includes(query) ||
              summary.totalQuantity.toString().includes(query)
          );
      }

      // Sort
      data.sort((a, b) => {
          if (sortConfig.key === 'totalQuantity') {
              return sortConfig.direction === 'asc' 
                  ? a.totalQuantity - b.totalQuantity 
                  : b.totalQuantity - a.totalQuantity;
          }
          
          // We need to check if sortConfig.key is a valid key of item
          const sortKey = sortConfig.key as keyof HardwareSummaryItemDetails;

          const aVal = (a.item[sortKey] || '').toString().toLowerCase();
          const bVal = (b.item[sortKey] || '').toString().toLowerCase();

          if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });

      return data;
  }, [report, searchQuery, sortConfig]);

  const SortIcon: React.FC<{ columnKey: SortKey }> = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) {
            return <div className="w-4 h-4 ml-1 inline-block opacity-0 group-hover:opacity-30"><ChevronDownIcon className="w-4 h-4" /></div>;
        }
        return sortConfig.direction === 'asc' ? (
            <ChevronUpIcon className="w-4 h-4 ml-1 inline-block text-primary-600" />
        ) : (
            <ChevronDownIcon className="w-4 h-4 ml-1 inline-block text-primary-600" />
        );
    };

  const renderHeader = (label: string, key: SortKey, align: 'left' | 'right' = 'left') => (
      <th 
          scope="col" 
          className={`px-6 py-3 cursor-pointer hover:bg-gray-200 group select-none text-${align}`}
          onClick={() => handleSort(key)}
      >
          <div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
              {label}
              <SortIcon columnKey={key} />
          </div>
      </th>
  );

  if (!report || report.doorsWithHardware === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center mb-4">
          <DocumentChartBarIcon className="w-6 h-6 text-primary-600 mr-3" />
          <h2 className="text-xl font-bold text-gray-700">Estimation Report</h2>
        </div>
        <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-500">No Hardware Assigned</h3>
            <p className="text-gray-400 mt-2">The report will be generated automatically once hardware is assigned to doors.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <div className="flex items-center">
          <DocumentChartBarIcon className="w-6 h-6 text-primary-600 mr-3" />
          <h2 className="text-xl font-bold text-gray-700">Estimation Report</h2>
        </div>
        <button
          onClick={handleExport}
          disabled={!report || report.doorsWithHardware === 0}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 font-semibold transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownTrayIcon className="w-5 h-5" />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-primary-50 p-4 rounded-md text-center">
            <p className="text-sm font-medium text-primary-700">Total Doors</p>
            <p className="text-3xl font-bold text-primary-900">{report.totalDoors}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-md text-center">
            <p className="text-sm font-medium text-green-700">Doors Processed</p>
            <p className="text-3xl font-bold text-green-900">{report.doorsWithHardware}</p>
        </div>
         {/* Search Bar */}
        <div className="flex items-center">
             <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="Filter by Item or Quantity..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
            </div>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-600 mb-4">Hardware Quantity Takeoff</h3>
       <div className="overflow-x-auto border border-gray-200 rounded-md max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm text-left text-gray-500 relative">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10 shadow-sm">
            <tr>
              <th scope="col" className="px-6 py-3">S/N</th>
              {renderHeader('Item', 'name')}
              {renderHeader('Manufacturer', 'manufacturer')}
              {renderHeader('Description', 'description')}
              {renderHeader('Finish', 'finish')}
              {renderHeader('Door Material', 'doorMaterial')}
              {renderHeader('Total Qty', 'totalQuantity', 'right')}
              <th scope="col" className="px-6 py-3">Source Set(s)</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedHardware.map(({ item, totalQuantity, sourceSets }, index) => (
              <tr key={`${item.name}-${item.manufacturer}-${item.finish}-${item.description}-${item.doorMaterial}`} className="bg-white border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{index + 1}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                <td className="px-6 py-4">{item.manufacturer}</td>
                <td className="px-6 py-4">{item.description}</td>
                <td className="px-6 py-4">{item.finish}</td>
                <td className="px-6 py-4">{item.doorMaterial || 'N/A'}</td>
                <td className="px-6 py-4 text-right font-bold text-primary-800">{totalQuantity}</td>
                <td className="px-6 py-4 text-xs text-gray-500">{(sourceSets || []).join(', ')}</td>
              </tr>
            ))}
             {filteredAndSortedHardware.length === 0 && (
                <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                        No items match your search.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EstimationReport;
