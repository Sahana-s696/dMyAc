const fs = require('fs');
const content = fs.readFileSync('D:\\MyAc\\DMyAc\\src\\pages\\AccountStatementPage.tsx', 'utf8');

const oldSection = `<div className="divide-y divide-slate-100 dark:divide-slate-600">
                  {pageRows.map(({ transaction, balance, movement }) => {
                    const details = getRegisterDetails(transaction, movement)
                    const isSelected = selectedRows.has(transaction.id)
                    const isTransfer = transaction.transaction_type === 'transfer'
                    const typeLabel = isTransfer ? 'Transfer' : movement > 0 ? 'Deposit' : 'Withdrawal'
                    const typeColor = isTransfer ? 'text-blue-700 dark:text-blue-300' : movement > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'

                    return (
                      <article key={transaction.id} className={\`px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors \${isSelected ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''}\`}>
                        <div className="flex items-start justify-between gap-4">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleRowSelection(transaction.id)} aria-label={\`Select \${transaction.description}\`} className="h-4 w-4 mt-0.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{transaction.description}</p>
                              <span className={\`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-800 \${typeColor}\`}>
                                {typeLabel}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-4">
                              <span>{dateLabel(transaction.transaction_date)}</span>
                              <span>Ref: {transaction.reference_number ?? '—'}</span>
                              <span>From: {details.fromAccount}</span>
                              <span>Category: {details.category}</span>
                              {details.toAccount !== '—' && <span>To: {details.toAccount}</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              <p className={\`text-sm font-semibold \${movement >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}\`}>
                                {movement >= 0 ? '+' : '−'}{currency(Math.abs(movement))}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Balance: {currency(balance)}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => editTransaction(transaction.id)} className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-blue-950 dark:hover:text-blue-300" aria-label={\`Edit \${transaction.description}\`}>
                                <PencilLine className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => void removeTransaction(transaction)} disabled={deletingTransactionId !== null} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-40 dark:text-slate-300 dark:hover:bg-rose-950 dark:hover:text-rose-300" aria-label={\`Delete \${transaction.description}\`}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
                   <div className="divide-y divide-slate-100 dark:divide-slate-600 md:hidden">`;

const newSection = `<div className="hidden overflow-x-auto md:block">
                     <table className="min-w-[1180px] w-full text-left text-xs" style={{ tableLayout: 'fixed' }}>
                       <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                         <tr>
                           <th ref={(el) => { thRefs.current[0] = el }} className="px-2.5 py-1.5 font-semibold w-8" style={{ width: columnWidths[0] }}><input ref={selectAllRef} type="checkbox" checked={allPageRowsSelected} onChange={toggleSelectAll} aria-label="Select all rows on this page" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /></th>
                           <th ref={(el) => { thRefs.current[1] = el }} className="px-2.5 py-1.5 font-semibold relative" style={{ width: columnWidths[1] }}>Date<div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300" onMouseDown={(e) => handleResizeMouseDown(1, e)} title="Resize column" /></th>
                           <th ref={(el) => { thRefs.current[2] = el }} className="px-2.5 py-1.5 font-semibold relative" style={{ width: columnWidths[2] }}>Description<div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300" onMouseDown={(e) => handleResizeMouseDown(2, e)} title="Resize column" /></th>
                           <th ref={(el) => { thRefs.current[3] = el }} className="px-2.5 py-1.5 text-right font-semibold relative" style={{ width: columnWidths[3] }}>Deposit<div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300" onMouseDown={(e) => handleResizeMouseDown(3, e)} title="Resize column" /></th>
                           <th ref={(el) => { thRefs.current[4] = el }} className="px-2.5 py-1.5 text-right font-semibold relative" style={{ width: columnWidths[4] }}>Withdrawal<div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300" onMouseDown={(e) => handleResizeMouseDown(4, e)} title="Resize column" /></th>
                           <th ref={(el) => { thRefs.current[5] = el }} className="px-2.5 py-1.5 text-right font-semibold relative" style={{ width: columnWidths[5] }}>Balance<div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300" onMouseDown={(e) => handleResizeMouseDown(5, e)} title="Resize column" /></th>
                           <th ref={(el) => { thRefs.current[6] = el }} className="px-2.5 py-1.5 text-right font-semibold" style={{ width: columnWidths[6] }}>Actions</th>
                         </tr>
                       </thead>
                       <tbody>
                         {pageRows.map(({ transaction, balance, movement }) => {
                           const isSelected = selectedRows.has(transaction.id)
                           const isTransfer = transaction.transaction_type === 'transfer'
                           const isDeposit = movement > 0

                           return (
                             <tr key={transaction.id} className={\`transaction-row border-t border-slate-200 odd:bg-slate-50/60 dark:border-slate-700 dark:odd:bg-slate-900/25 \${isSelected ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''}\`}>
                               <td className="px-2.5 py-2 text-center" style={{ width: columnWidths[0] }}><input type="checkbox" checked={isSelected} onChange={() => toggleRowSelection(transaction.id)} aria-label={\`Select \${transaction.description}\`} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /></td>
                               <td className="whitespace-nowrap px-2.5 py-2 text-xs leading-[18px] tabular-nums text-slate-700 dark:text-slate-300" style={{ width: columnWidths[1] }}>{dateLabel(transaction.transaction_date)}</td>
                               <td className="px-2.5 py-2 text-[11px] leading-[18px] font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs" style={{ width: columnWidths[2] }}>{transaction.description}</td>
                               <td className="whitespace-nowrap px-2.5 py-2 text-right text-xs leading-[18px] font-medium tabular-nums text-emerald-700 dark:text-emerald-400" style={{ width: columnWidths[3] }}>{isDeposit && !isTransfer ? currency(movement) : '—'}</td>
                               <td className="whitespace-nowrap px-2.5 py-2 text-right text-xs leading-[18px] font-medium tabular-nums text-rose-700 dark:text-rose-400" style={{ width: columnWidths[4] }}>{!isDeposit && !isTransfer ? currency(Math.abs(movement)) : isTransfer ? currency(Math.abs(movement)) : '—'}</td>
                               <td className="whitespace-nowrap px-2.5 py-2 text-right text-xs leading-[18px] font-semibold tabular-nums text-slate-800 dark:text-slate-200" style={{ width: columnWidths[5] }}>{currency(balance)}</td>
                               <td className="px-2.5 py-2 text-right" style={{ width: columnWidths[6] }}>
                                 <div className="inline-flex items-center">
                                   <button type="button" onClick={() => editTransaction(transaction.id)} aria-label={\`Edit \${transaction.description}\`} className="rounded-md p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-blue-950 dark:hover:text-blue-300">
                                     <PencilLine className="h-3.5 w-3.5" />
                                   </button>
                                   <button type="button" onClick={() => void removeTransaction(transaction)} disabled={deletingTransactionId !== null} aria-label={\`Delete \${transaction.description}\`} className="rounded-md p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-40 dark:text-slate-300 dark:hover:bg-rose-950 dark:hover:text-rose-300">
                                     <Trash2 className="h-3.5 w-3.5" />
                                   </button>
                                 </div>
                               </td>
                             </tr>
                           )
                         })}
                       </tbody>
                     </table>
                   </div>
                   <div className="divide-y divide-slate-100 dark:divide-slate-600 md:hidden">`;

const newContent = content.replace(oldSection, newSection);
fs.writeFileSync('D:\\MyAc\\DMyAc\\src\\pages\\AccountStatementPage.tsx', newContent, 'utf8');
console.log('Done');