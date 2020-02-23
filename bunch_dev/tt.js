const { define, resolve, Observable, ComputedObservable, debug } = bunch({ debug: true});

define('documentReady', function () {
    return new Promise((pResolve, pReject) => {
        document.addEventListener("DOMContentLoaded", pResolve);
    });
});

define('debounce', function () {
    return (delay, callee) => {
        let lastCall = Date.now() - delay;
        return (...args) => {
            const now = Date.now();
            if (now - lastCall > delay) {
                lastCall = now;
                return callee(...args);    
            } else {
                lastCall = now;
            }
        };
    };
});

define('Timer', [{ noCache: true }, function () {
    let lastChange = window.performance.now();
    const obs = Observable('');
    obs.onChange(msg => {
        const now = window.performance.now();
        console.log(`Timer: ${msg} - after ${(now - lastChange).toString().substring(0, 5)} ms`);
        lastChange = now;
    });
    return obs;
}]);

define('dateUtils', function () {
    return {
        dateShortString: timestamp => new Date(timestamp).toLocaleTimeString(undefined, { hour12: false }),
    };
});

define('docUtils', function (documentReady) {
    const utils = {
        getByID: id => {
            return document.getElementById(id);
        },
        getSelector: selector => {
            return document.querySelector(selector);
        },
        getObservableForElementValue: id => {
            const elem = utils.getByID(id);
            const observable$ = Observable(elem.value);

            elem.addEventListener('change', function () {
                observable$.value = elem.value; 
            });
            return observable$;
        },
        setTextFor: (id, value) => {
            const elem = utils.getByID(id);

            (function removeChildren () {
                while (elem.firstChild) {
                    elem.removeChild(elem.firstChild);
                }
            }());
            elem.appendChild(document.createTextNode(value));
        }
    };
    return utils
});

define('now', function () {
    const now$ = Observable(Date.now());
    const updateTime = () => {
        now$.value = Date.now();
        setTimeout(updateTime, 1000);
    };

    updateTime();
    return now$;
});

define('Timeline', function (dateUtils) {
    const Entry = (name, timestamp_start, timestamp_end = null) => {
        if (!timestamp_start) {
            throw 'Entries need a timestamp_start!';
        }

        if (timestamp_end && timestamp_end <= timestamp_start) {
            throw 'timestamp_end <= timestamp_start. That makes no sense!';
        }

        const self = {
            name,
            timestamp_start,
            timestamp_end,
            hasEnd: () => self.timestamp_end !== null,
            isDone: () => self.timestamp_end <= Date.now(),
            isInProgress: () => self.timestamp_start <= Date.now() && !(self.hasEnd() && self.isDone()),
            finishNow: () => self.timestamp_end = Date.now(),
            toString: () => `${self.name}: ${dateUtils.dateShortString(self.timestamp_start)} - ${dateUtils.dateShortString(self.timestamp_end)}`,
        };

        return self;
    }

    const entriesModifier = {
        checkForOverlap_findCurrent: newEntries => {
            const entryComparison = (a, b) => a.timestamp_start - b.timestamp_start;
            newEntries.sort(entryComparison);

            let lastEntry = undefined;
            let setEntryinProgress = false;
            const toBe = {
                inProgress: undefined,
                nextUp: undefined
            };

            newEntries.forEach(function checkForOverlap_findCurrent (thisEntry) {
                if (lastEntry && lastEntry.hasEnd() && thisEntry.timestamp_start < lastEntry.timestamp_end) {
                    throw `Found overlap between ${lastEntry.toString()} and ${thisEntry.toString()}`;
                } else {
                    if (thisEntry.isInProgress()) {
                        if (setEntryinProgress) {
                            throw `Two entries in progress: ${entryObservables.inProgress$.value.name} and ${thisEntry.name}`;
                        }
                        toBe.inProgress = thisEntry;
                        setEntryinProgress = true;
                    } else if (setEntryinProgress && lastEntry.isInProgress()) {
                        toBe.nextUp = thisEntry;
                    }

                    lastEntry = thisEntry;
                }
            });
            return toBe;
        },
        apply: (entries, toBe) => {
            entryObservables.entries$.value = entries;
            entryObservables.inProgress$.value = toBe.inProgress;
            entryObservables.nextUp$.value = toBe.nextUp;
        },
        onChange: (entries) => {
            const toBe = entriesModifier.checkForOverlap_findCurrent(entries);
            entriesModifier.apply(entries, toBe);
        },
        pushEntry: (newEntry) => {
            const newEntries = [...entryObservables.entries$.value, newEntry];
            entriesModifier.onChange(newEntries);
        }
    }

    const entryObservables = {
        inProgress$: Observable(undefined),
        nextUp$: Observable(undefined),
        entries$: Observable([])
    };

    return {
        addEntry: (...args) => {
            const entryToAdd = Entry(...args);
            return entriesModifier.pushEntry(entryToAdd);
        },
        currentEntry$: Observable(entryObservables.inProgress$, true),
        nextEntry$: Observable(entryObservables.nextUp$, true),
        entries$: Observable(entryObservables.entries$, true),
    };
});

resolve(function UiClock (docUtils, now$) {
    const clockElem = docUtils.getByID('time_select_now_clock');
    now$.stream(now => {
        // console.log('now: ', now)
        const date = new Date(now);
        const dateString = date.toLocaleTimeString(undefined, {
            hour12: false
        });
        docUtils.setTextFor('time_select_now_clock', dateString);
    });
});

resolve(function generateTestData (Timeline, now, ComputedObservable, Observable) {
    const hours_to_ms = hours => hours * 60 * 60 * 1000;

    const addEntryWith = (name, a_now_minus, b_now_minus) => {
        if (!b_now_minus) {
            Timeline.addEntry(name, now - a_now_minus);
        } else {
            Timeline.addEntry(name, now - a_now_minus, now - b_now_minus);
        }
    };

    addEntryWith('sdf', hours_to_ms(10), hours_to_ms(8));
    addEntryWith('Dodsfne3', hours_to_ms(7.9), hours_to_ms(7.5));
    addEntryWith('Don23wsefe4', hours_to_ms(7.4), hours_to_ms(7));
    addEntryWith('Donesd5', hours_to_ms(6), hours_to_ms(5.5));
    addEntryWith('Donesdf6', hours_to_ms(5.4), hours_to_ms(5.3));
    addEntryWith('Donesd1', hours_to_ms(5), hours_to_ms(4.5));
    addEntryWith('Done3', hours_to_ms(4), hours_to_ms(3));
    addEntryWith('Done4', hours_to_ms(3), hours_to_ms(2.5));
    addEntryWith('Done5', hours_to_ms(2.2), hours_to_ms(2));
    addEntryWith('Done6', hours_to_ms(1), hours_to_ms(0.5));
    addEntryWith('inProgress', hours_to_ms(0.2));
});

define('CanvasEntriesRow', () => {
    return function CanvasEntriesRow ({ entries, width, height, timeTranslator, contextTranslator }) {
        const translatedRender = contextTranslator((ctx) => {            
            entries.forEach(entry => {
                const pos = {
                    x: width * timeTranslator(entry.timestamp_start),
                    width: entry.timestamp_end ? width * (timeTranslator(entry.timestamp_end) - timeTranslator(entry.timestamp_start)) : undefined
                };
                ctx.fillStyle = 'lightgray';
                ctx.fillRect(pos.x, height / 4, pos.width, height / 2);
                console.log('Filling: ', pos);
                ctx.fillStyle = 'black';
                ctx.fillText(entry.name, pos.x, height / 4, pos.width);
            });
        });
        return {
            render: translatedRender
        };
    }
});

define('CanvasRowLayout', (CanvasEntriesRow, dateUtils) => {
    return function CanvasRowLayout ({ entries, rowHeight, rowPadding, width, height }) {
        const timeTranslator = (timeStart, timeEnd) => {
            // console.log('timeTranslator ', {timeStart, timeEnd});
            return timeStamp => (timeStamp - timeStart) / (timeEnd - timeStart);
        };
        
        const contextTranslator = ({ posX, posY }) => {
            return (callee) => {
                return (ctx) => {
                    ctx.setTransform(1, 0, 0, 1, posX, posY);
                    callee(ctx);
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                };
            };
        };

        const findBestSlicingIndex = timestamp => {
            let bestDiff = timeDiffTotal;
            let sliceIndex = undefined;
            entries.forEach((entry, index) => {
                const diffStart = Math.abs(timestamp - entry.timestamp_start);
                const diffEnd = Math.abs(timestamp - entry.timestamp_end);

                const isStart = diffStart < diffEnd;
                const diffLeast = isStart ? diffStart : diffEnd;
                // console.log('diffLeast: ', { diffLeast, bestDiff });
                if (diffLeast <= bestDiff) {
                    bestDiff = diffLeast;
                    //console.log(`Debug: `, { when: dateUtils.dateShortString(timestamp), entry: entry.toString(), isStart });
                    sliceIndex = isStart ? index : index + 1;
                }
            });
            return sliceIndex;
        }

        const rowCount = Math.floor(height / (rowHeight + rowPadding));
        const lastEntry = entries[entries.length - 1];
        const startTime = entries[0].timestamp_start;
        const endTime = lastEntry.timestamp_end || Math.max(lastEntry.timestamp_start, Date.now());
        const timeDiffTotal = endTime - startTime;
        const timeSlice = timeDiffTotal / rowCount;

        const rows = [];
        let lastSliceIndex = 0;
        for (i = 0; i < rowCount; i++) {
            const rowEndIdeal = startTime + (i + 1) * timeSlice;

            const sliceIndex = findBestSlicingIndex(rowEndIdeal);
            if (sliceIndex === lastSliceIndex) {
                continue;
            }
            const rowTimeStart = entries[lastSliceIndex - 1] ?
                (entries[lastSliceIndex - 1].timestamp_end || entries[lastSliceIndex].timestamp_start) :
                startTime + i * timeSlice;
            const rowTimeEnd = entries[sliceIndex] ? entries[sliceIndex].timestamp_start : rowEndIdeal;

            console.log('debug: ', {sliceIndex, rowTimeStart, rowTimeEnd, sliceIndex, lastSliceIndex });
            console.log('Creating row with: ', entries.slice(lastSliceIndex, sliceIndex).map(entry => entry.toString()).join(', '));

            rows.push(CanvasEntriesRow({
                entries: entries.slice(lastSliceIndex, sliceIndex),
                width: width - 2 * rowPadding,
                height: rowHeight,
                timeTranslator: timeTranslator(rowTimeStart, rowTimeEnd),
                contextTranslator: contextTranslator({
                    posX: rowPadding,
                    posY:  i * (rowHeight + rowPadding) + rowPadding
                })
            }));
            lastSliceIndex = sliceIndex;
        }

        return {
            render: (ctx) => {
                rows.forEach(row => row.render(ctx));
            }
        }
    };
});

resolve(function ttCanvas (Timeline, docUtils, now$, debounce, CanvasRowLayout, Timer$) {
    const canvasElem = docUtils.getByID('entries_canvas');
    const ctx = canvasElem.getContext('2d');

    const render = (width, height) => {
        const rowLayout = CanvasRowLayout({
            entries: Timeline.entries$.value,
            rowHeight: 80,
            rowPadding: 20,
            width,
            height
        });
        Timer$.value = 'Finished creating CanvasRowLayout.';
        rowLayout.render(ctx);
        Timer$.value = 'Finished rendering';
    }

    const sizeFix = (function () {
        const observer = new ResizeObserver(debounce(20, () => {
            ctx.canvas.width = canvasElem.scrollWidth;
            ctx.canvas.height = canvasElem.scrollHeight;
            render(canvasElem.scrollWidth, canvasElem.scrollHeight);
        }));

        observer.observe(canvasElem);
    }());
});