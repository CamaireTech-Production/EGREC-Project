import React, { useMemo } from 'react';
import { useTable, useSortBy, usePagination, useGlobalFilter } from 'react-table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Lock } from 'lucide-react';

interface UserTableProps {
  users: any[];
  onEditUser: (user: any) => void;
  onDeleteUser: (userId: string) => void;
  onToggleStatus: (userId: string, currentStatus: boolean) => void;
  onResetPassword: (email: string) => void;
  onManagePermissions: (user: any) => void;
  isAdmin: boolean;
}

const UserTable: React.FC<UserTableProps> = ({
  users,
  onEditUser,
  onDeleteUser,
  onToggleStatus,
  onResetPassword,
  onManagePermissions,
  isAdmin
}) => {
  const columns = useMemo(
    () => [
      {
        Header: 'Utilisateur',
        accessor: (row: any) => `${row.firstName} ${row.lastName}`,
        Cell: ({ row }: any) => (
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-[#8B4513] text-white flex items-center justify-center mr-3">
              {row.original.firstName[0]}{row.original.lastName[0]}
            </div>
            <div>
              <div className="font-medium">{row.original.firstName} {row.original.lastName}</div>
              {row.original.phone && (
                <div className="text-sm text-gray-500">{row.original.phone}</div>
              )}
            </div>
          </div>
        ),
      },
      {
        Header: 'Email',
        accessor: 'email',
      },
      {
        Header: 'Grade',
        accessor: 'role',
        Cell: ({ value }: { value: string }) => (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {value}
          </span>
        ),
      },
      {
        Header: 'Inscription',
        accessor: 'createdAt',
        Cell: ({ value }: { value: string }) => (
          format(new Date(value), 'dd/MM/yyyy', { locale: fr })
        ),
      },
      {
        Header: 'Dernière connexion',
        accessor: 'lastSignInTime',
        Cell: ({ value }: { value: string | null }) => (
          value ? format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'Jamais connecté'
        ),
      },
      {
        Header: 'Statut',
        accessor: 'disabled',
        Cell: ({ value }: { value: boolean }) => (
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            value ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
            {value ? 'Inactif' : 'Actif'}
          </span>
        ),
      },
    ],
    []
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    prepareRow,
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    setGlobalFilter,
    state: { pageIndex, pageSize, globalFilter },
  } = useTable(
    {
      columns,
      data: users,
      initialState: { pageIndex: 0, pageSize: 10 },
    },
    useGlobalFilter,
    useSortBy,
    usePagination
  );

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <input
          type="text"
          value={globalFilter || ''}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder="Rechercher un utilisateur..."
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
        />
      </div>

      <div className="overflow-x-auto">
        <table {...getTableProps()} className="w-full">
          <thead className="bg-gray-50">
            {headerGroups.map(headerGroup => (
              <tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map(column => (
                  <th
                    {...column.getHeaderProps(column.getSortByToggleProps())}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    <div className="flex items-center">
                      {column.render('Header')}
                      <span className="ml-2">
                        {column.isSorted ? (
                          column.isSortedDesc ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )
                        ) : null}
                      </span>
                    </div>
                  </th>
                ))}
                {isAdmin && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()} className="bg-white divide-y divide-gray-200">
            {page.map(row => {
              prepareRow(row);
              return (
                <tr {...row.getRowProps()} className="hover:bg-gray-50">
                  {row.cells.map(cell => (
                    <td {...cell.getCellProps()} className="px-6 py-4 whitespace-nowrap">
                      {cell.render('Cell')}
                    </td>
                  ))}
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-3">
                        <button
                          onClick={() => onToggleStatus(row.original.id, !!row.original.disabled)}
                          className={`text-gray-500 hover:text-${row.original.disabled ? 'green' : 'red'}-600`}
                          title={row.original.disabled ? 'Activer le compte' : 'Désactiver le compte'}
                        >
                          <span className="sr-only">
                            {row.original.disabled ? 'Activer' : 'Désactiver'}
                          </span>
                          {row.original.disabled ? '✓' : '✕'}
                        </button>
                        <button
                          onClick={() => onResetPassword(row.original.email)}
                          className="text-gray-500 hover:text-blue-600"
                          title="Réinitialiser le mot de passe"
                        >
                          <span className="sr-only">Réinitialiser le mot de passe</span>
                          🔑
                        </button>
                        <button
                          onClick={() => onManagePermissions(row.original)}
                          className="text-gray-500 hover:text-[#8B4513]"
                          title="Gérer les permissions"
                        >
                          <Lock className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => onEditUser(row.original)}
                          className="text-gray-500 hover:text-[#8B4513]"
                          title="Modifier l'utilisateur"
                        >
                          <span className="sr-only">Modifier</span>
                          ✎
                        </button>
                        <button
                          onClick={() => onDeleteUser(row.original.id)}
                          className="text-gray-500 hover:text-red-600"
                          title="Supprimer l'utilisateur"
                        >
                          <span className="sr-only">Supprimer</span>
                          🗑
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => previousPage()}
            disabled={!canPreviousPage}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Précédent
          </button>
          <button
            onClick={() => nextPage()}
            disabled={!canNextPage}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Suivant
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div className="flex gap-x-2 items-center">
            <span className="text-sm text-gray-700">
              Page <span className="font-medium">{pageIndex + 1}</span> sur{' '}
              <span className="font-medium">{pageOptions.length}</span>
            </span>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="text-sm border-gray-300 rounded-md focus:ring-[#8B4513] focus:border-[#8B4513]"
            >
              {[10, 20, 30, 40, 50].map(size => (
                <option key={size} value={size}>
                  Afficher {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-x-2">
            <button
              onClick={() => gotoPage(0)}
              disabled={!canPreviousPage}
              className="relative inline-flex items-center px-2 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-500 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Première page</span>
              <ChevronsLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => previousPage()}
              disabled={!canPreviousPage}
              className="relative inline-flex items-center px-2 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-500 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Page précédente</span>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => nextPage()}
              disabled={!canNextPage}
              className="relative inline-flex items-center px-2 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-500 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Page suivante</span>
              <ChevronRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => gotoPage(pageCount - 1)}
              disabled={!canNextPage}
              className="relative inline-flex items-center px-2 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-500 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Dernière page</span>
              <ChevronsRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserTable;