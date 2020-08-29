/* AxisBox.tsx
 * ================
 *
 * Standard axis box layout model. Precompute before rendering and pass it around.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-02-11
 */

import * as React from "react"
import { observable, computed, reaction, action } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "charts/utils/Bounds"
import { AxisScale, Tickmark } from "./AxisScale"
import { AxisSpec } from "./AxisSpec"
import { ScaleType } from "charts/core/ChartConstants"
import { extend, sortBy, maxBy, uniq } from "charts/utils/Util"
import classNames from "classnames"
import { TextWrap } from "charts/text/TextWrap"
import { ControlsOverlay } from "charts/controls/Controls"
import { ScaleSelector } from "charts/controls/ScaleSelector"
import { AxisTickMarks } from "./AxisTickMarks"

interface AxisBoxProps {
    bounds: Bounds
    fontSize: number
    xAxisSpec: AxisSpec
    yAxisSpec: AxisSpec
}

// AxisBox has the important task of coordinating two axes so that they work together!
// There is a *two-way dependency* between the bounding size of each axis.
// e.g. if the y axis becomes wider because a label is present, the x axis then has less
// space to work with, and vice versa
export class AxisBox {
    private props: AxisBoxProps

    @observable private targetYDomain: [number, number] = [1, 100]
    @observable private targetXDomain: [number, number] = [1, 100]
    @observable private prevYDomain: [number, number] = [1, 100]
    @observable private prevXDomain: [number, number] = [1, 100]
    @observable private animProgress?: number
    private frameStart?: number

    constructor(props: AxisBoxProps) {
        this.props = props
    }

    @computed.struct private get currentYDomain(): [number, number] {
        if (this.animProgress === undefined) return this.props.yAxisSpec.domain

        const [prevMinY, prevMaxY] = this.prevYDomain
        const [targetMinY, targetMaxY] = this.targetYDomain

        // If we have a log axis and are animating from linear to log do not set domain min to 0
        const progress = this.animProgress
            ? this.animProgress
            : this.props.yAxisSpec.scaleType === ScaleType.log
            ? 0.01
            : 0

        return [
            prevMinY + (targetMinY - prevMinY) * progress,
            prevMaxY + (targetMaxY - prevMaxY) * this.animProgress
        ]
    }

    @computed.struct private get currentXDomain(): [number, number] {
        if (this.animProgress === undefined) return this.props.xAxisSpec.domain

        const [prevMinX, prevMaxX] = this.prevXDomain
        const [targetMinX, targetMaxX] = this.targetXDomain

        // If we have a log axis and are animating from linear to log do not set domain min to 0
        const progress = this.animProgress
            ? this.animProgress
            : this.props.xAxisSpec.scaleType === ScaleType.log
            ? 0.01
            : 0

        return [
            prevMinX + (targetMinX - prevMinX) * progress,
            prevMaxX + (targetMaxX - prevMaxX) * this.animProgress
        ]
    }

    @action.bound setupAnimation() {
        this.targetYDomain = this.props.yAxisSpec.domain
        this.targetXDomain = this.props.xAxisSpec.domain
        this.animProgress = 1

        reaction(
            () => [this.props.yAxisSpec.domain, this.props.xAxisSpec.domain],
            () => {
                this.prevXDomain = this.currentXDomain
                this.prevYDomain = this.currentYDomain
                this.targetYDomain = this.props.yAxisSpec.domain
                this.targetXDomain = this.props.xAxisSpec.domain
                this.animProgress = 0
                requestAnimationFrame(this.frame)
            }
        )
    }

    @action.bound private frame(timestamp: number) {
        if (this.animProgress === undefined) return

        if (!this.frameStart) this.frameStart = timestamp
        this.animProgress = Math.min(
            1,
            this.animProgress + (timestamp - this.frameStart) / 300
        )

        if (this.animProgress < 1) requestAnimationFrame(this.frame)
        else this.frameStart = undefined
    }

    @computed get yAxisSpec() {
        return extend({}, this.props.yAxisSpec, { domain: this.currentYDomain })
    }

    @computed get xAxisSpec() {
        return extend({}, this.props.xAxisSpec, { domain: this.currentXDomain })
    }

    // We calculate an initial width/height for the axes in isolation
    @computed private get xAxisHeight() {
        return new HorizontalAxis({
            scale: new AxisScale(this.xAxisSpec).clone({
                range: [0, this.props.bounds.width]
            }),
            labelText: this.xAxisSpec.label,
            fontSize: this.props.fontSize
        }).height
    }

    @computed private get yAxisWidth() {
        return new VerticalAxis({
            scale: new AxisScale(this.yAxisSpec).clone({
                range: [0, this.props.bounds.height]
            }),
            labelText: this.yAxisSpec.label,
            fontSize: this.props.fontSize
        }).width
    }

    // Now we can determine the "true" inner bounds of the axis box
    @computed get innerBounds(): Bounds {
        return this.props.bounds
            .padBottom(this.xAxisHeight)
            .padLeft(this.yAxisWidth)
    }

    @computed get xScale() {
        return new AxisScale(this.xAxisSpec).clone({
            range: this.innerBounds.xRange()
        })
    }

    @computed get yScale() {
        return new AxisScale(this.yAxisSpec).clone({
            range: this.innerBounds.yRange()
        })
    }

    @computed get horizontalAxis() {
        const that = this
        return new HorizontalAxis({
            get scale() {
                return that.xScale
            },
            get labelText() {
                return that.xAxisSpec.label
            },
            get fontSize() {
                return that.props.fontSize
            }
        })
    }

    @computed get verticalAxis() {
        const that = this
        return new VerticalAxis({
            get scale() {
                return that.yScale
            },
            get labelText() {
                return that.yAxisSpec.label
            },
            get fontSize() {
                return that.props.fontSize
            }
        })
    }

    @computed get bounds() {
        return this.props.bounds
    }
}

interface AxisGridLinesProps {
    orient: "left" | "bottom"
    scale: AxisScale
    bounds: Bounds
}

@observer
export class AxisGridLines extends React.Component<AxisGridLinesProps> {
    render() {
        const { orient, bounds } = this.props
        const scale = this.props.scale.clone({
            range: orient === "left" ? bounds.yRange() : bounds.xRange()
        })

        return (
            <g
                className={classNames(
                    "AxisGridLines",
                    orient === "left" ? "horizontalLines" : "verticalLines"
                )}
            >
                {scale.getTickValues().map((t, i) => {
                    const color = t.faint
                        ? "#eee"
                        : t.value === 0
                        ? "#ccc"
                        : "#d3d3d3"
                    if (orient === "left")
                        return (
                            <line
                                key={i}
                                x1={bounds.left.toFixed(2)}
                                y1={scale.place(t.value)}
                                x2={bounds.right.toFixed(2)}
                                y2={scale.place(t.value)}
                                stroke={color}
                                strokeDasharray={
                                    t.value !== 0 ? "3,2" : undefined
                                }
                            />
                        )
                    else
                        return (
                            <line
                                key={i}
                                x1={scale.place(t.value)}
                                y1={bounds.bottom.toFixed(2)}
                                x2={scale.place(t.value)}
                                y2={bounds.top.toFixed(2)}
                                stroke={color}
                                strokeDasharray={
                                    t.value !== 0 ? "3,2" : undefined
                                }
                            />
                        )
                })}
            </g>
        )
    }
}

interface AxisBoxViewProps {
    axisBox: AxisBox
    highlightValue?: { x: number; y: number }
    showTickMarks: boolean
    isInteractive: boolean
}

@observer
export class AxisBoxView extends React.Component<AxisBoxViewProps> {
    componentDidMount() {
        requestAnimationFrame(this.props.axisBox.setupAnimation)
    }

    render() {
        const { axisBox, showTickMarks } = this.props
        const {
            bounds,
            xScale,
            yScale,
            horizontalAxis,
            verticalAxis,
            innerBounds
        } = axisBox

        const maxX = undefined // {chartView.tabBounds.width} todo

        return (
            <g className="AxisBoxView">
                <HorizontalAxisBox
                    maxX={maxX}
                    bounds={bounds}
                    axisPosition={innerBounds.bottom}
                    axis={horizontalAxis}
                    showTickMarks={showTickMarks}
                    isInteractive={this.props.isInteractive}
                />
                <VerticalAxisBox
                    bounds={bounds}
                    axis={verticalAxis}
                    isInteractive={this.props.isInteractive}
                />
                {!yScale.hideGridlines && (
                    <AxisGridLines
                        orient="left"
                        scale={yScale}
                        bounds={innerBounds}
                    />
                )}
                {!xScale.hideGridlines && (
                    <AxisGridLines
                        orient="bottom"
                        scale={xScale}
                        bounds={innerBounds}
                    />
                )}
            </g>
        )
    }
}

interface AxisProps {
    scale: AxisScale
    labelText: string
    fontSize: number
}

abstract class AbstractAxis {
    protected props: AxisProps
    constructor(props: AxisProps) {
        this.props = props
    }

    @computed get tickFontSize() {
        return 0.9 * this.props.fontSize
    }

    protected doIntersect(bounds: Bounds, bounds2: Bounds) {
        return bounds.intersects(bounds2)
    }

    @computed get ticks(): number[] {
        const { tickPlacements } = this
        for (let i = 0; i < tickPlacements.length; i++) {
            for (let j = i + 1; j < tickPlacements.length; j++) {
                const t1 = tickPlacements[i],
                    t2 = tickPlacements[j]
                if (t1 === t2 || t1.isHidden || t2.isHidden) continue
                if (this.doIntersect(t1.bounds, t2.bounds)) {
                    t2.isHidden = true
                }
            }
        }

        return sortBy(tickPlacements.filter(t => !t.isHidden).map(t => t.tick))
    }

    // calculates coordinates for ticks, sorted by priority
    @computed private get tickPlacements() {
        const { scale } = this
        return sortBy(this.baseTicks, tick => tick.priority).map(tick => {
            const bounds = Bounds.forText(
                scale.tickFormat(tick.value, {
                    ...this.tickFormattingOptions,
                    isFirstOrLastTick: !!tick.isFirstOrLastTick
                }),
                {
                    fontSize: this.tickFontSize
                }
            )
            return {
                tick: tick.value,
                bounds: bounds.extend(this.placeTick(tick.value, bounds)),
                isHidden: false
            }
        })
    }

    @computed get tickFormattingOptions() {
        return this.scale.getTickFormattingOptions()
    }

    @computed get scale() {
        return this.props.scale
    }

    @computed get labelFontSize() {
        return 0.7 * this.props.fontSize
    }

    @computed protected get baseTicks(): Tickmark[] {
        return this.scale.getTickValues().filter(tick => !tick.gridLineOnly)
    }

    abstract get labelWidth(): number

    protected abstract placeTick(
        tickValue: number,
        bounds: Bounds
    ): { x: number; y: number }

    @computed get label(): TextWrap | undefined {
        const text = this.props.labelText
        return text
            ? new TextWrap({
                  maxWidth: this.labelWidth,
                  fontSize: this.labelFontSize,
                  text
              })
            : undefined
    }
}

// Axis layout model. Computes the space needed for displaying an axis.
export class VerticalAxis extends AbstractAxis {
    @computed get labelWidth() {
        return this.height
    }

    @computed get labelOffset(): number {
        return this.label ? this.label.height + 10 : 0
    }

    @computed get width() {
        const { props, labelOffset } = this
        const longestTick = maxBy(
            props.scale.getFormattedTicks(),
            tick => tick.length
        )
        return (
            Bounds.forText(longestTick, { fontSize: this.tickFontSize }).width +
            labelOffset +
            5
        )
    }

    @computed get height() {
        return this.props.scale.rangeSize
    }

    protected placeTick(tickValue: number, bounds: Bounds) {
        const { scale } = this
        return {
            y: scale.place(tickValue),
            // x placement doesn't really matter here, so we're using
            // 1 for simplicity
            x: 1
        }
    }
}

@observer
export class VerticalAxisBox extends React.Component<{
    bounds: Bounds
    axis: VerticalAxis
    isInteractive: boolean
}> {
    @computed get controls() {
        const { bounds, axis } = this.props
        const { scale } = axis
        const showControls =
            this.props.isInteractive && scale.scaleTypeOptions.length > 1
        if (!showControls) return undefined
        return (
            <ControlsOverlay id="vertical-scale-selector" paddingTop={18}>
                <ScaleSelector
                    x={bounds.left}
                    y={bounds.top - 34}
                    scaleTypeConfig={scale}
                />
            </ControlsOverlay>
        )
    }

    render() {
        const { bounds, axis } = this.props
        const { scale, ticks, label, tickFormattingOptions } = axis
        const textColor = "#666"

        return (
            <g className="VerticalAxisBox">
                {label &&
                    label.render(
                        -bounds.centerY - label.width / 2,
                        bounds.left,
                        { transform: "rotate(-90)" }
                    )}
                {ticks.map((tick, i) => (
                    <text
                        key={i}
                        x={(bounds.left + axis.width - 5).toFixed(2)}
                        y={scale.place(tick)}
                        fill={textColor}
                        dominantBaseline="middle"
                        textAnchor="end"
                        fontSize={axis.tickFontSize}
                    >
                        {scale.tickFormat(tick, tickFormattingOptions)}
                    </text>
                ))}
                {this.controls}
            </g>
        )
    }
}

// Axis layout model. Computes the space needed for displaying an axis.
export class HorizontalAxis extends AbstractAxis {
    private static labelPadding = 5

    @computed get labelOffset(): number {
        return this.label
            ? this.label.height + HorizontalAxis.labelPadding * 2
            : 0
    }

    @computed get labelWidth() {
        return this.props.scale.rangeSize
    }

    @computed get height() {
        const { props, labelOffset } = this
        const firstFormattedTick = props.scale.getFormattedTicks()[0]
        const fontSize = this.tickFontSize

        return (
            Bounds.forText(firstFormattedTick, {
                fontSize
            }).height +
            labelOffset +
            5
        )
    }

    @computed protected get baseTicks(): Tickmark[] {
        let ticks = super.baseTicks
        const { domain } = this.scale

        // Make sure the start and end values are present, if they're whole numbers
        const startEndPrio = this.scale.scaleType === ScaleType.log ? 2 : 1
        if (domain[0] % 1 === 0)
            ticks = [
                {
                    value: domain[0],
                    priority: startEndPrio,
                    isFirstOrLastTick: true
                },
                ...ticks
            ]
        if (domain[1] % 1 === 0 && this.scale.hideFractionalTicks)
            ticks = [
                ...ticks,
                {
                    value: domain[1],
                    priority: startEndPrio,
                    isFirstOrLastTick: true
                }
            ]
        return uniq(ticks)
    }

    protected placeTick(tickValue: number, bounds: Bounds) {
        const { scale, labelOffset } = this
        return {
            x: scale.place(tickValue) - bounds.width / 2,
            y: bounds.bottom - labelOffset
        }
    }

    // Add some padding before checking for intersection
    protected doIntersect(bounds: Bounds, bounds2: Bounds) {
        return bounds.intersects(bounds2.padWidth(-5))
    }
}

export class HorizontalAxisBox extends React.Component<{
    bounds: Bounds
    axis: HorizontalAxis
    axisPosition: number
    maxX?: number
    showTickMarks?: boolean
    isInteractive: boolean
    onScaleTypeChange?: (scaleType: ScaleType) => void // We need this because on DiscreteBar scaleType change behaves differently
}> {
    @computed get controls() {
        const { bounds, axis, onScaleTypeChange, maxX } = this.props
        const { scale } = axis
        const showControls =
            this.props.isInteractive && scale.scaleTypeOptions.length > 1
        if (!showControls) return undefined

        return (
            <ControlsOverlay id="horizontal-scale-selector" paddingBottom={10}>
                <ScaleSelector
                    maxX={maxX}
                    x={bounds.right}
                    y={bounds.bottom}
                    scaleTypeConfig={scale}
                    onScaleTypeChange={onScaleTypeChange}
                />
            </ControlsOverlay>
        )
    }

    render() {
        const { bounds, axis, axisPosition, showTickMarks } = this.props
        const { scale, ticks, label, labelOffset, tickFormattingOptions } = axis
        const textColor = "#666"

        const tickMarks = showTickMarks ? (
            <AxisTickMarks
                tickMarkTopPosition={axisPosition}
                tickMarkXPositions={ticks.map(tick => scale.place(tick))}
                color="#ccc"
            />
        ) : undefined

        return (
            <g className="HorizontalAxis">
                {label &&
                    label.render(
                        bounds.centerX - label.width / 2,
                        bounds.bottom - label.height
                    )}
                {tickMarks}
                {ticks.map((tick, i) => {
                    const label = scale.tickFormat(tick, {
                        ...tickFormattingOptions,
                        isFirstOrLastTick: i === 0 || i === ticks.length - 1
                    })
                    const rawXPosition = scale.place(tick)
                    // Ensure the first label does not exceed the chart viewing area
                    const xPosition =
                        i === 0
                            ? Bounds.getRightShiftForMiddleAlignedTextIfNeeded(
                                  label,
                                  axis.tickFontSize,
                                  rawXPosition
                              ) + rawXPosition
                            : rawXPosition
                    const element = (
                        <text
                            key={i}
                            x={xPosition}
                            y={bounds.bottom - labelOffset}
                            fill={textColor}
                            textAnchor="middle"
                            fontSize={axis.tickFontSize}
                        >
                            {label}
                        </text>
                    )

                    return element
                })}
                {this.controls}
            </g>
        )
    }
}
