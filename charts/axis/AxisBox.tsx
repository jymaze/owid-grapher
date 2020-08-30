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
import {
    VerticalAxisView,
    HorizontalAxisView,
    AbstractAxisView
} from "./AxisScale"
import { ScaleType } from "charts/core/ChartConstants"
import classNames from "classnames"
import { ControlsOverlay } from "charts/controls/Controls"
import { ScaleSelector } from "charts/controls/ScaleSelector"
import { AxisTickMarks } from "./AxisTickMarks"

interface AxisBoxProps {
    bounds: Bounds
    xAxisView: HorizontalAxisView
    yAxisView: VerticalAxisView
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
        if (this.animProgress === undefined) return this.props.yAxisView.domain

        const [prevMinY, prevMaxY] = this.prevYDomain
        const [targetMinY, targetMaxY] = this.targetYDomain

        // If we have a log axis and are animating from linear to log do not set domain min to 0
        const progress = this.animProgress
            ? this.animProgress
            : this.props.yAxisView.scaleType === ScaleType.log
            ? 0.01
            : 0

        return [
            prevMinY + (targetMinY - prevMinY) * progress,
            prevMaxY + (targetMaxY - prevMaxY) * this.animProgress
        ]
    }

    @computed.struct private get currentXDomain(): [number, number] {
        if (this.animProgress === undefined) return this.props.xAxisView.domain

        const [prevMinX, prevMaxX] = this.prevXDomain
        const [targetMinX, targetMaxX] = this.targetXDomain

        // If we have a log axis and are animating from linear to log do not set domain min to 0
        const progress = this.animProgress
            ? this.animProgress
            : this.props.xAxisView.scaleType === ScaleType.log
            ? 0.01
            : 0

        return [
            prevMinX + (targetMinX - prevMinX) * progress,
            prevMaxX + (targetMaxX - prevMaxX) * this.animProgress
        ]
    }

    @action.bound setupAnimation() {
        this.targetYDomain = this.props.yAxisView.domain
        this.targetXDomain = this.props.xAxisView.domain
        this.animProgress = 1

        reaction(
            () => [this.props.yAxisView.domain, this.props.xAxisView.domain],
            () => {
                this.prevXDomain = this.currentXDomain
                this.prevYDomain = this.currentYDomain
                this.targetYDomain = this.props.yAxisView.domain
                this.targetXDomain = this.props.xAxisView.domain
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

    // todo: Refactor
    @computed private get yAxisView() {
        const view = this.props.yAxisView.clone()
        view.domain = this.currentYDomain
        return view
    }

    // todo: Refactor
    @computed private get xAxisView() {
        const view = this.props.xAxisView.clone()
        view.domain = this.currentXDomain
        return view
    }

    // todo: Refactor
    @computed get xAxisViewWithRange() {
        const view = this.xAxisView.clone()
        view.range = this.innerBounds.xRange()
        return view
    }

    // todo: Refactor
    @computed get yAxisViewWithRange() {
        const view = this.yAxisView.clone()
        view.range = this.innerBounds.yRange()
        return view
    }

    // todo: Refactor
    // We calculate an initial width/height for the axes in isolation
    @computed private get xAxisHeight() {
        const view = this.xAxisView.clone()
        view.range = [0, this.props.bounds.width]
        return view.height
    }

    // todo: Refactor
    @computed private get yAxisWidth() {
        const view = this.yAxisView.clone()
        view.range = [0, this.props.bounds.height]
        return view.width
    }

    // Now we can determine the "true" inner bounds of the axis box
    @computed get innerBounds(): Bounds {
        return this.props.bounds
            .padBottom(this.xAxisHeight)
            .padLeft(this.yAxisWidth)
    }

    @computed get bounds() {
        return this.props.bounds
    }
}

interface AxisGridLinesProps {
    orient: "left" | "bottom"
    axisView: AbstractAxisView
    bounds: Bounds
}

@observer
export class AxisGridLines extends React.Component<AxisGridLinesProps> {
    render() {
        const { orient, bounds } = this.props
        const view = this.props.axisView.clone()
        view.range = orient === "left" ? bounds.yRange() : bounds.xRange()

        return (
            <g
                className={classNames(
                    "AxisGridLines",
                    orient === "left" ? "horizontalLines" : "verticalLines"
                )}
            >
                {view.getTickValues().map((t, i) => {
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
                                y1={view.place(t.value)}
                                x2={bounds.right.toFixed(2)}
                                y2={view.place(t.value)}
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
                                x1={view.place(t.value)}
                                y1={bounds.bottom.toFixed(2)}
                                x2={view.place(t.value)}
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
            xAxisViewWithRange,
            yAxisViewWithRange,
            innerBounds
        } = axisBox

        const maxX = undefined // {chartView.tabBounds.width} todo

        return (
            <g className="AxisBoxView">
                <HorizontalAxisBox
                    maxX={maxX}
                    bounds={bounds}
                    axisPosition={innerBounds.bottom}
                    axis={xAxisViewWithRange}
                    showTickMarks={showTickMarks}
                    isInteractive={this.props.isInteractive}
                />
                <VerticalAxisBox
                    bounds={bounds}
                    axis={yAxisViewWithRange}
                    isInteractive={this.props.isInteractive}
                />
                {!yAxisViewWithRange.hideGridlines && (
                    <AxisGridLines
                        orient="left"
                        axisView={yAxisViewWithRange}
                        bounds={innerBounds}
                    />
                )}
                {!xAxisViewWithRange.hideGridlines && (
                    <AxisGridLines
                        orient="bottom"
                        axisView={xAxisViewWithRange}
                        bounds={innerBounds}
                    />
                )}
            </g>
        )
    }
}

@observer
export class VerticalAxisBox extends React.Component<{
    bounds: Bounds
    axis: VerticalAxisView
    isInteractive: boolean
}> {
    @computed get controls() {
        const { bounds, axis } = this.props
        const showControls =
            this.props.isInteractive && axis.scaleTypeOptions.length > 1
        if (!showControls) return undefined
        return (
            <ControlsOverlay id="vertical-scale-selector" paddingTop={18}>
                <ScaleSelector
                    x={bounds.left}
                    y={bounds.top - 34}
                    scaleTypeConfig={axis}
                />
            </ControlsOverlay>
        )
    }

    render() {
        const { bounds, axis } = this.props
        const { ticks, labelTextWrap: label } = axis
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
                        y={axis.place(tick)}
                        fill={textColor}
                        dominantBaseline="middle"
                        textAnchor="end"
                        fontSize={axis.tickFontSize}
                    >
                        {axis.formatTick(tick)}
                    </text>
                ))}
                {this.controls}
            </g>
        )
    }
}

export class HorizontalAxisBox extends React.Component<{
    bounds: Bounds
    axis: HorizontalAxisView
    axisPosition: number
    maxX?: number
    showTickMarks?: boolean
    isInteractive: boolean
    onScaleTypeChange?: (scaleType: ScaleType) => void // We need this because on DiscreteBar scaleType change behaves differently
}> {
    @computed get controls() {
        const { bounds, axis, onScaleTypeChange, maxX } = this.props
        const showControls =
            this.props.isInteractive && axis.scaleTypeOptions.length > 1
        if (!showControls) return undefined

        return (
            <ControlsOverlay id="horizontal-scale-selector" paddingBottom={10}>
                <ScaleSelector
                    maxX={maxX}
                    x={bounds.right}
                    y={bounds.bottom}
                    scaleTypeConfig={axis}
                    onScaleTypeChange={onScaleTypeChange}
                />
            </ControlsOverlay>
        )
    }

    render() {
        const { bounds, axis, axisPosition, showTickMarks } = this.props
        const { ticks, labelTextWrap: label, labelOffset } = axis
        const textColor = "#666"

        const tickMarks = showTickMarks ? (
            <AxisTickMarks
                tickMarkTopPosition={axisPosition}
                tickMarkXPositions={ticks.map(tick => axis.place(tick))}
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
                    const label = axis.formatTick(
                        tick,
                        i === 0 || i === ticks.length - 1
                    )
                    const rawXPosition = axis.place(tick)
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
